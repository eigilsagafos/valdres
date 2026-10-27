/**
 * Real-engine check for `@valdres/public-ip` and `@valdres/bandwidth`, with
 * every network response controlled by the driver.
 *
 * WHAT IT PROVES (native Chromium behavior)
 *   The page's own `fetch`, `AbortController` and streamed response bodies:
 *   import, dormant reads, subscriptions and the `online` / `visibilitychange`
 *   events request nothing and attach no listener (including to the native
 *   `navigator.connection`); an explicit request publishes pending and then
 *   the address to a root store, its scope and an independent store; a
 *   same-origin request carries no cookie and no `Referer`; `fresh` makes the
 *   browser cancel the replaced request; cancelling the only caller cancels
 *   the browser request and restores the previous state; failing endpoints
 *   fall through; a throwing subscriber is reported through the page's error
 *   event while the request resolves; a disposed store hears nothing more; a
 *   shortened measurement runs latency, download (streamed) and upload, and a
 *   measurement cancelled mid-download cancels its in-flight requests and
 *   keeps the previous result.
 *
 * WHAT IS CONTROLLED, NOT NATIVE
 *   Every request is paused by DevTools Fetch interception before it leaves
 *   the browser and answered locally (documentation-range addresses, zero-
 *   filled bodies). Nothing reaches ipify, icanhazip or Cloudflare; only the
 *   probe's own page document is served from 127.0.0.1. Throughput numbers are
 *   therefore local delivery rates and meaningless as measurements. A response
 *   that arrives after its abort cannot be produced natively (the browser
 *   rejects an aborted fetch), so the stale-result guard is proven by the
 *   package suites and their mutation controls, not here.
 *
 *   bun run scripts/network-probe/run.ts
 *   CHROME=/path/to/chrome OUT=evidence.json bun run scripts/network-probe/run.ts
 */
import { strict as assert } from "node:assert"
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"

const HERE = import.meta.dir
const bundle = await Bun.build({
    entrypoints: [join(HERE, "page.ts")],
    target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
})
if (!bundle.success) {
    for (const log of bundle.logs) console.error(log)
    process.exit(1)
}
const pageSource = await bundle.outputs[0]!.text()
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>network probe</title></head>
<body><p>network probe</p><script type="module">${pageSource}</script></body></html>`
const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: request =>
        new URL(request.url).pathname === "/"
            ? new Response(HTML, {
                  headers: { "content-type": "text/html; charset=utf-8" },
              })
            : new Response("not served", { status: 404 }),
})
const ORIGIN = server.url.origin

const chrome = [
    process.env.CHROME,
    join(
        homedir(),
        "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
].find((path): path is string => path !== undefined && existsSync(path))
if (chrome === undefined) {
    console.error("No Chrome found; set CHROME=/path/to/chrome")
    process.exit(2)
}
const profile = mkdtempSync(join(tmpdir(), "valdres-network-probe-"))
const browser = Bun.spawn(
    [
        chrome,
        ...(process.env.HEADED ? [] : ["--headless=new"]),
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
)
const portFile = join(profile, "DevToolsActivePort")
for (let i = 0; i < 200 && !existsSync(portFile); i++) await Bun.sleep(50)
const [port, path] = readFileSync(portFile, "utf8").trim().split("\n")
const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`)
await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
})

let nextId = 0
const waiting = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
>()
const listeners: ((method: string, params: any) => void)[] = []
socket.onmessage = message => {
    const data = JSON.parse(String(message.data))
    if (data.id === undefined) {
        for (const listener of listeners) listener(data.method, data.params)
        return
    }
    const waiter = waiting.get(data.id)
    if (waiter === undefined) return
    waiting.delete(data.id)
    if (data.error) waiter.reject(new Error(JSON.stringify(data.error)))
    else waiter.resolve(data.result)
}
const send = (
    method: string,
    params: object = {},
    sessionId?: string,
): Promise<any> => {
    const id = ++nextId
    socket.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((resolve, reject) =>
        waiting.set(id, { resolve, reject }),
    )
}
const version = await send("Browser.getVersion")
const { targetId } = await send("Target.createTarget", { url: "about:blank" })
const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
})
const page = (method: string, params: object = {}) =>
    send(method, params, sessionId)

// ── interception ────────────────────────────────────────────────────────────
interface Paused {
    readonly requestId: string
    readonly networkId: string
    readonly url: string
    readonly method: string
    readonly headers: Record<string, string>
    readonly resourceType: string
}
const paused: Paused[] = []
const allRequests: {
    url: string
    method: string
    resourceType: string
    continued: boolean
}[] = []
const cancelled = new Set<string>()
const protocolErrors: string[] = []
const browserOwn: string[] = []
let auto:
    | ((
          request: Paused,
      ) => { body: Uint8Array | string; status?: number } | undefined)
    | undefined
const lower = (headers: Record<string, string>) =>
    Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
            key.toLowerCase(),
            value,
        ]),
    )
const fulfill = (
    request: Paused,
    body: Uint8Array | string = "",
    status = 200,
) =>
    page("Fetch.fulfillRequest", {
        requestId: request.requestId,
        responseCode: status,
        responseHeaders: [
            { name: "content-type", value: "text/plain" },
            { name: "access-control-allow-origin", value: "*" },
        ],
        body: Buffer.from(body).toString("base64"),
    })
listeners.push((method, params) => {
    if (method === "Network.loadingFailed" && params.canceled)
        cancelled.add(params.requestId)
    if (method !== "Fetch.requestPaused") return
    const request: Paused = {
        requestId: params.requestId,
        networkId: params.networkId,
        url: params.request.url,
        method: params.request.method,
        headers: lower(params.request.headers),
        resourceType: params.resourceType,
    }
    const local =
        request.resourceType === "Document" && request.url.startsWith(ORIGIN)
    allRequests.push({
        url: request.url,
        method: request.method,
        resourceType: request.resourceType,
        continued: local,
    })
    const record = (error: Error) =>
        protocolErrors.push(`${request.url}: ${error.message}`)
    if (local) {
        page("Fetch.continueRequest", { requestId: request.requestId }).catch(
            record,
        )
        return
    }
    // The browser's own requests (favicon) are answered locally and are not
    // the packages'; only the page's fetches are held for the scenarios.
    if (request.resourceType !== "Fetch" && request.resourceType !== "XHR") {
        fulfill(request, "", 404).catch(record)
        browserOwn.push(request.url)
        return
    }
    const answer = auto?.(request)
    if (answer) fulfill(request, answer.body, answer.status).catch(record)
    else paused.push(request)
})
await page("Network.enable")
await page("Fetch.enable", {
    patterns: [{ urlPattern: "*", requestStage: "Request" }],
})
await page("Runtime.enable")

const evaluate = async (expression: string) => {
    const result = await page("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
    })
    if (result.exceptionDetails)
        throw new Error(
            `${expression}: ${JSON.stringify(result.exceptionDetails)}`,
        )
    return result.result.value
}
const probe = (call: string) => evaluate(`window.networkProbe.${call}`)
const take = async (predicate: (request: Paused) => boolean, label: string) => {
    for (let i = 0; i < 200; i++) {
        const index = paused.findIndex(predicate)
        if (index !== -1) return paused.splice(index, 1)[0]!
        await Bun.sleep(10)
    }
    throw new Error(
        `no paused request for ${label}; paused: ${paused.map(r => r.url).join(", ")}; seen: ${JSON.stringify(allRequests)}`,
    )
}
const pause = () => Bun.sleep(150)

await page("Page.navigate", { url: `${ORIGIN}/` })
for (let i = 0; i < 100; i++) {
    if (await evaluate("typeof window.networkProbe === 'object'")) break
    await Bun.sleep(50)
}

const evidence: Record<string, unknown> = {
    browser: version.product,
    executable: chrome,
    headless: !process.env.HEADED,
}
const problems: string[] = []
const check = (label: string, fn: () => void) => {
    try {
        fn()
    } catch (error) {
        problems.push(
            `${label}: ${(error as Error).message.replace(/\s+/g, " ").slice(0, 500)}`,
        )
    }
}

evidence.environment = await probe("environment()")
const afterImport = await probe("afterImport()")
const subscribed = await probe("subscribe()")
await pause()
evidence.inert = {
    afterImport,
    attachedAfterSubscribe: subscribed.attached,
    pausedRequests: paused.map(r => r.url),
}
check(
    "import, reads, subscriptions and online/visibility events request nothing and attach nothing",
    () => {
        assert.deepEqual(afterImport.attached, [])
        assert.equal(afterImport.dormant.status, "idle")
        assert.deepEqual(subscribed.attached, [])
        assert.deepEqual(paused, [])
    },
)

// S1: one explicit request, published to root, scope and an independent store.
const pending = await probe(`start("s1", "ip")`)
const s1 = await take(r => r.url === "https://api.ipify.org/", "s1")
await fulfill(s1, "203.0.113.7\n")
const s1Outcome = await probe(`outcome("s1")`)
const s1State = await probe("snapshot()")
evidence.request = {
    pendingStatus: pending.any.status,
    url: s1.url,
    headers: s1.headers,
    outcome: s1Outcome,
    any: s1State.any,
    log: s1State.log,
}
check(
    "an explicit request publishes pending, then the address to every store",
    () => {
        assert.equal(pending.any.status, "pending")
        assert.deepEqual(s1Outcome, { ok: true, value: "203.0.113.7" })
        assert.equal(s1State.any.status, "ready")
        assert.equal(s1State.childAny.ip, "203.0.113.7")
        for (const key of ["root", "child", "other"])
            assert.deepEqual(
                s1State.log[key],
                ["pending:-", "ready:203.0.113.7"],
                key,
            )
        assert.equal(s1.headers.referer, undefined)
    },
)

// S2: same-origin endpoint: credentials "omit" and no-referrer, natively.
await probe("setCookie()")
await probe(`start("s2", "ip", { endpoints: ["${ORIGIN}/ip"], fresh: true })`)
const s2 = await take(r => r.url === `${ORIGIN}/ip`, "s2")
await fulfill(s2, "203.0.113.8")
evidence.sameOrigin = {
    headers: s2.headers,
    outcome: await probe(`outcome("s2")`),
}
check("a same-origin request carries no cookie and no Referer", () => {
    assert.equal(s2.headers.cookie, undefined)
    assert.equal(s2.headers.referer, undefined)
})

// S3: fresh replaces a request in flight; the browser cancels the old one.
await probe(`start("s3a", "ip", { family: "v4" })`)
const s3a = await take(r => r.url === "https://api4.ipify.org/", "s3a")
await probe(`start("s3b", "ip", { family: "v4", fresh: true })`)
const s3b = await take(r => r.url === "https://api4.ipify.org/", "s3b")
await pause()
await fulfill(s3b, "198.51.100.23")
const s3 = {
    a: await probe(`outcome("s3a")`),
    b: await probe(`outcome("s3b")`),
    state: (await probe("snapshot()")).v4,
}
let lateFulfill: string
try {
    await fulfill(s3a, "203.0.113.99")
    lateFulfill = "accepted by DevTools"
} catch (error) {
    lateFulfill = `rejected by DevTools: ${(error as Error).message.slice(0, 120)}`
}
await pause()
evidence.replacement = {
    ...s3,
    replacedRequestCancelled: cancelled.has(s3a.networkId),
    lateFulfill,
    stateAfterLate: (await probe("snapshot()")).v4,
}
check(
    "fresh cancels the replaced browser request; the newer answer wins",
    () => {
        assert.equal(s3.a.name, "AbortError")
        assert.deepEqual(s3.b, { ok: true, value: "198.51.100.23" })
        assert.equal(cancelled.has(s3a.networkId), true)
        assert.equal(
            (evidence.replacement as any).stateAfterLate.ip,
            "198.51.100.23",
        )
    },
)

// S4: cancelling the only caller cancels the browser request and restores state.
const before4 = (await probe("snapshot()")).any
await probe(`start("s4", "ip", { cancellable: true })`)
const s4 = await take(r => r.url === "https://api.ipify.org/", "s4")
await probe(`abort("s4")`)
await pause()
const s4State = (await probe("snapshot()")).any
evidence.cancellation = {
    outcome: await probe(`outcome("s4")`),
    browserCancelled: cancelled.has(s4.networkId),
    restored: s4State,
}
check(
    "cancelling the only caller cancels the request and restores the state",
    () => {
        assert.equal((evidence.cancellation as any).outcome.name, "AbortError")
        assert.equal(cancelled.has(s4.networkId), true)
        assert.deepEqual(s4State, before4)
    },
)

// S5: failing endpoints fall through; a throwing subscriber is reported.
await probe("throwingStore()")
await probe(`start("s5", "ip", { family: "v6" })`)
await fulfill(
    await take(r => r.url === "https://api6.ipify.org/", "s5a"),
    "",
    503,
)
await fulfill(
    await take(r => r.url === "https://ipv6.icanhazip.com/", "s5b"),
    "<html>not an address</html>",
)
const s5 = {
    outcome: await probe(`outcome("s5")`),
    state: (await probe("snapshot()")).v6,
}
await pause()
const reported = (await probe("snapshot()")).reported
evidence.failure = { ...s5, reported }
check(
    "failing endpoints fall through to an error state; subscriber failures are reported",
    () => {
        assert.equal(s5.outcome.name, "AggregateError")
        assert.deepEqual(s5.outcome.causes, [
            "https://api6.ipify.org responded 503",
            "https://ipv6.icanhazip.com did not return an IPv6 address",
        ])
        assert.equal(s5.state.status, "error")
        assert.ok(
            reported.length >= 2 &&
                reported.every(
                    (r: { name: string }) =>
                        r.name === "SubscriberNotificationError",
                ),
        )
    },
)

// S6: a disposed store hears nothing more.
const otherBefore = (await probe("disposeOther()")).log.other.length
await probe(`start("s6", "ip", { fresh: true })`)
await fulfill(
    await take(r => r.url === "https://api.ipify.org/", "s6"),
    "203.0.113.9",
)
await probe(`outcome("s6")`)
const s6 = await probe("snapshot()")
evidence.disposal = {
    otherNotificationsAfterDispose: s6.log.other.length - otherBefore,
    any: s6.any.ip,
}
check("a disposed store receives nothing", () => {
    assert.equal(s6.log.other.length, otherBefore)
    assert.equal(s6.any.ip, "203.0.113.9")
})

// S7: a shortened measurement against locally answered bodies.
const counts = { latency: 0, download: 0, upload: 0 }
const DOWNLOAD_BODY = new Uint8Array(512 * 1024)
auto = request => {
    if (request.url === "https://speed.cloudflare.com/__down?bytes=0")
        return counts.latency++, { body: "" }
    if (/^https:\/\/speed\.cloudflare\.com\/__down\?bytes=[1-9]/.test(request.url))
        return counts.download++, { body: DOWNLOAD_BODY }
    if (
        request.url === "https://speed.cloudflare.com/__up" &&
        request.method === "POST"
    )
        return counts.upload++, { body: "" }
    return undefined
}
// Time-bounded: locally answered bodies would spend the default byte limits
// inside one sampling interval (the suites cover the limits).
const fast = `{ latencySamples: 2, maxDurationMs: 600, minDurationMs: 300, warmupMs: 0, startStreams: 1, maxStreams: 2, maxDownloadBytes: Infinity, maxUploadBytes: Infinity }`
await probe(`start("s7", "bandwidth", ${fast})`)
const s7 = await probe(`outcome("s7")`)
const s7State = await probe("snapshot()")
evidence.measurement = {
    outcome: s7,
    counts: { ...counts },
    phases: s7State.bandwidth && s7State.log.bandwidth,
    result: s7State.bandwidth.result,
}
check(
    "a measurement runs latency, download and upload and publishes its result",
    () => {
        assert.equal(s7.ok, true)
        assert.deepEqual(s7State.log.bandwidth, [
            "pending/latency",
            "pending/download",
            "pending/upload",
            "ready",
        ])
        assert.equal(counts.latency, 3)
        assert.ok(counts.download >= 1 && counts.upload >= 1)
        assert.ok(s7.value.downloadMbps > 0 && s7.value.uploadMbps > 0)
        assert.deepEqual(s7State.bandwidth.result, s7.value)
    },
)

// S8: cancelled mid-download: the browser cancels the streams, the result stays.
auto = request =>
    request.url === "https://speed.cloudflare.com/__down?bytes=0"
        ? { body: "" }
        : undefined
await probe(
    `start("s8", "bandwidth", { latencySamples: 2, maxDurationMs: 5000, minDurationMs: 4000, warmupMs: 0, startStreams: 2, maxStreams: 2, cancellable: true })`,
)
const streams = [
    await take(r => /__down\?bytes=[1-9]/.test(r.url), "s8 stream 1"),
    await take(r => /__down\?bytes=[1-9]/.test(r.url), "s8 stream 2"),
]
await probe(`abort("s8")`)
await pause()
const s8State = await probe("snapshot()")
evidence.measurementCancellation = {
    outcome: await probe(`outcome("s8")`),
    streamsCancelled: streams.map(stream => cancelled.has(stream.networkId)),
    state: s8State.bandwidth,
}
check(
    "a measurement cancelled mid-download cancels its streams and keeps the previous result",
    () => {
        assert.equal(
            (evidence.measurementCancellation as any).outcome.name,
            "AbortError",
        )
        assert.deepEqual(
            (evidence.measurementCancellation as any).streamsCancelled,
            [true, true],
        )
        assert.equal(s8State.bandwidth.status, "ready")
        assert.deepEqual(s8State.bandwidth.result, s7.value)
        assert.equal(paused.filter(r => r.url.includes("__up")).length, 0)
    },
)
auto = undefined

evidence.leftTheBrowser = allRequests.filter(r => r.continued).map(r => r.url)
evidence.browserOwnRequestsAnsweredLocally = browserOwn
evidence.protocolErrors = protocolErrors
check("only the probe's own page document left the browser", () => {
    assert.deepEqual(evidence.leftTheBrowser, [`${ORIGIN}/`])
})
evidence.problems = problems

browser.kill()
server.stop(true)
rmSync(profile, { recursive: true, force: true })
const json = JSON.stringify(evidence, null, 2)
if (process.env.OUT) writeFileSync(process.env.OUT, json)
console.log(json)
if (problems.length > 0) {
    console.error(
        `\n${problems.length} expectation(s) failed:\n- ${problems.join("\n- ")}`,
    )
    process.exit(1)
}
console.error(`\nNETWORK_PROBE_OK (${version.product})`)
