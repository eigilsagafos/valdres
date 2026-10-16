/**
 * Real-engine counterpart to the Happy-DOM geometry suites of
 * `@valdres/browser-window` and `@valdres/browser-screen`.
 *
 * WHAT IT PROVES
 *   In a real Chromium, with the engine firing its own `resize`,
 *   `screen.orientation` `change` and `(resolution: Xdppx)` `change` events:
 *   import and dormant reads attach nothing; each store tree attaches one
 *   listener per kind of change and a child scope shares its root's; window
 *   size, pixel ratio and orientation updates arrive as single coherent
 *   snapshots shared by both stores; the resolution watch follows the ratio;
 *   events that change nothing notify nobody; unsubscribe and dispose release
 *   every listener. It also records which native events the engine fired, in
 *   which order, for each change.
 *
 * HOW IT DRIVES THE ENGINE
 *   Chrome DevTools Protocol over a WebSocket, no dependency. Real browser
 *   zoom — the Ctrl/Cmd-+ path, which moves `devicePixelRatio` and the CSS
 *   viewport — through `chrome.tabs.setZoom` in the bundled unpacked
 *   `zoom-extension/` (Chrome for Testing and Chromium load it; branded Chrome
 *   refuses `--load-extension`, so those steps are skipped there).
 *   `Browser.setWindowBounds` resizes the browser window itself.
 *   `Emulation.setDeviceMetricsOverride` with `screenOrientation` rotates an
 *   emulated mobile screen; the engine dispatches the events itself.
 *
 * OBSERVATIONS IT RECORDS, NOT ASSERTS
 *   Platform behavior the packages cannot change: whether `outerWidth` /
 *   `outerHeight` are already current when `resize` fires (in Chromium 151
 *   and 154 on macOS they were not), and native event order.
 *
 * WHAT IT DOES NOT PROVE
 *   Orientation is emulated, not a physical rotation. Changing only the
 *   emulated device scale factor fires neither `resize` nor a resolution
 *   query `change` in Chromium 151/154, so it is not used. A window moving
 *   between displays (Chromium's `screen` `change`) cannot be triggered here.
 *   Nothing about WebKit or Gecko. It bundles workspace source, not the packed
 *   artifacts (the packed gate covers those in Node).
 *
 *   bun run scripts/browser-geometry-probe/run.ts
 *   CHROME=/path/to/chrome bun run scripts/browser-geometry-probe/run.ts
 *   HEADED=1 bun run scripts/browser-geometry-probe/run.ts
 *
 * Writes the full evidence as JSON to stdout's last line and, with
 * `OUT=<file>`, to that file. Exits non-zero on any failed expectation.
 */
import { strict as assert } from "node:assert"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
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
const instrument = readFileSync(join(HERE, "instrument.js"), "utf8")
const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>geometry probe</title>
<script>${instrument}</script></head><body><p>geometry probe</p>
<script type="module">${pageSource}</script></body></html>`

const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () =>
        new Response(HTML, {
            headers: { "content-type": "text/html; charset=utf-8" },
        }),
})

const candidates = [
    process.env.CHROME,
    join(
        homedir(),
        "Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
].filter((path): path is string => path !== undefined && existsSync(path))
const chrome = candidates[0]
if (chrome === undefined) {
    console.error("No Chrome found; set CHROME=/path/to/chrome")
    process.exit(2)
}

const profile = mkdtempSync(join(tmpdir(), "valdres-geometry-probe-"))
const browser = Bun.spawn(
    [
        chrome,
        ...(process.env.HEADED ? [] : ["--headless=new"]),
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1200,900",
        `--load-extension=${join(HERE, "zoom-extension")}`,
        `--disable-extensions-except=${join(HERE, "zoom-extension")}`,
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
const pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
>()
socket.onmessage = message => {
    const data = JSON.parse(String(message.data))
    const waiter = data.id === undefined ? undefined : pending.get(data.id)
    if (waiter === undefined) return
    pending.delete(data.id)
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
        pending.set(id, { resolve, reject }),
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
await page("Page.enable")
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
// Two frames, then a short pause: resize, orientation and media query changes
// are all delivered by the rendering update that follows the change.
const settle = () =>
    evaluate(
        "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50))))",
    )
const call = (name: string) => evaluate(`window.geometryProbe.${name}()`)

await page("Page.navigate", { url: server.url.href })
for (let i = 0; i < 100; i++) {
    if (await evaluate("typeof window.geometryProbe === 'object'")) break
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
            `${label}: ${(error as Error).message.replace(/\s+/g, " ").slice(0, 400)}`,
        )
    }
}

evidence.environment = await call("environment")
const afterImport = await call("afterImport")
evidence.afterImport = afterImport
check("import attaches nothing", () => {
    assert.deepEqual(afterImport, { attached: {}, queries: [] })
})

const dormant = await call("dormantRead")
evidence.dormant = dormant
check("a dormant read measures without attaching", () => {
    assert.deepEqual(dormant.attached, {})
    assert.deepEqual(dormant.queries, [])
    assert.equal(dormant.size.innerWidth, dormant.live.innerWidth)
    assert.equal(dormant.info.devicePixelRatio, dormant.live.devicePixelRatio)
    assert.equal(dormant.sameObjectOnReread, true)
    assert.equal(dormant.frozen, true)
})

const env = evidence.environment as {
    screenIsEventTarget: boolean
    hasScreenOrientation: boolean
}
const subscribed = await call("subscribe")
evidence.subscribed = subscribed
check(
    "each store tree attaches one listener per kind; the child scope shares",
    () => {
        // Two trees: window size + screen each listen to resize.
        assert.deepEqual(subscribed.attached, {
            "window:resize": 4,
            ...(env.hasScreenOrientation ? { "orientation:change": 2 } : {}),
            ...(env.screenIsEventTarget ? { "screen:change": 2 } : {}),
            "resolution:change": 2,
        })
    },
)
await settle()
await call("take")

const steps: Record<string, unknown>[] = []
const step = async (
    label: string,
    act: () => Promise<unknown>,
    expect: (r: any) => void,
) => {
    await act()
    await settle()
    const result = await call("take")
    steps.push({ label, ...result })
    check(label, () => expect(result))
    return result
}
const count = (r: any, store: string, state: string) =>
    r.notifications.filter((n: any) => n.store === store && n.state === state)
        .length

await step(
    "viewport 800x600 (emulated): window size publishes once per store",
    () =>
        page("Emulation.setDeviceMetricsOverride", {
            width: 800,
            height: 600,
            deviceScaleFactor: 1,
            mobile: false,
        }),
    r => {
        assert.equal(r.first.size.innerWidth, 800)
        assert.equal(r.first.size.innerHeight, 600)
        assert.equal(count(r, "first", "window"), 1)
        assert.equal(count(r, "second", "window"), 1)
        assert.equal(r.sharedSnapshot, true)
        assert.ok(
            r.natives.some((n: any) => n.event === "window:resize"),
            "no native resize",
        )
    },
)

// Real browser zoom, through the bundled extension's service worker.
let zoomWorker: string | undefined
for (let i = 0; i < 40 && zoomWorker === undefined; i++) {
    const { targetInfos } = await send("Target.getTargets")
    for (const worker of targetInfos.filter(
        (t: any) => t.type === "service_worker",
    )) {
        const session = (
            await send("Target.attachToTarget", {
                targetId: worker.targetId,
                flatten: true,
            })
        ).sessionId
        const probe = await send(
            "Runtime.evaluate",
            { expression: "typeof zoomProbeTab", returnByValue: true },
            session,
        )
        if (probe.result?.value === "function") zoomWorker = session
    }
    if (zoomWorker === undefined) await Bun.sleep(100)
}
evidence.realZoom = zoomWorker !== undefined
const zoom = (factor: number) =>
    send(
        "Runtime.evaluate",
        { expression: `zoomProbeTab(${factor})`, awaitPromise: true },
        zoomWorker,
    )
if (zoomWorker !== undefined) {
    await page("Emulation.clearDeviceMetricsOverride")
    await settle()
    await call("take")
    const base = (await call("take")).live.devicePixelRatio as number
    for (const factor of [2, 3, 1.1, 1])
        await step(
            `real browser zoom ${Math.round(factor * 100)}%: ratio and viewport publish once per store`,
            () => zoom(factor),
            r => {
                assert.equal(
                    r.first.screen.devicePixelRatio,
                    r.live.devicePixelRatio,
                )
                assert.ok(
                    Math.abs(r.live.devicePixelRatio - base * factor) < 0.01,
                    "zoom did not move the ratio",
                )
                assert.equal(r.first.size.innerWidth, r.live.innerWidth)
                assert.equal(
                    count(r, "first", "screen"),
                    1,
                    "screen publications",
                )
                assert.equal(count(r, "second", "screen"), 1)
                assert.equal(count(r, "child", "ratio"), 1)
                assert.equal(
                    r.attached["resolution:change"],
                    2,
                    "one resolution watch per tree",
                )
                assert.ok(
                    r.natives.some((n: any) => n.event === "resolution:change"),
                    "no native resolution change",
                )
                assert.equal(r.sharedSnapshot, true)
            },
        )
    await page("Emulation.setDeviceMetricsOverride", {
        width: 800,
        height: 600,
        deviceScaleFactor: 3,
        mobile: false,
    })
    await settle()
    await call("take")
} else {
    console.log(
        "(no zoom extension in this browser build: real-zoom steps skipped)",
    )
    await page("Emulation.setDeviceMetricsOverride", {
        width: 800,
        height: 600,
        deviceScaleFactor: 3,
        mobile: false,
    })
    await settle()
    await call("take")
}

const portrait = await step(
    "rotate to portrait-primary (emulated mobile screen 600x800)",
    () =>
        page("Emulation.setDeviceMetricsOverride", {
            width: 600,
            height: 800,
            deviceScaleFactor: 3,
            mobile: true,
            screenWidth: 600,
            screenHeight: 800,
            screenOrientation: { type: "portraitPrimary", angle: 0 },
        }),
    r => {
        assert.equal(r.first.screen.orientationType, "portrait-primary")
        assert.equal(r.first.screen.width, 600)
        assert.equal(r.first.screen.height, 800)
        assert.equal(r.first.size.innerWidth, 600)
        // Every screen notification carried a whole, consistent reading.
        for (const n of r.notifications.filter(
            (n: any) => n.state === "screen",
        ))
            assert.ok(
                n.value.orientationType === "portrait-primary"
                    ? n.value.width <= n.value.height
                    : n.value.width >= n.value.height,
                `torn reading ${JSON.stringify(n.value)}`,
            )
        assert.equal(count(r, "child", "isWide"), 1)
    },
)
evidence.portraitScreenNotificationsPerStore = count(
    portrait,
    "first",
    "screen",
)

await step(
    "rotate to landscape-primary @ 90 (emulated mobile screen 800x600)",
    () =>
        page("Emulation.setDeviceMetricsOverride", {
            width: 800,
            height: 600,
            deviceScaleFactor: 3,
            mobile: true,
            screenWidth: 800,
            screenHeight: 600,
            screenOrientation: { type: "landscapePrimary", angle: 90 },
        }),
    r => {
        assert.equal(r.first.screen.orientationType, "landscape-primary")
        assert.equal(r.first.screen.orientationAngle, 90)
        assert.equal(r.first.screen.width, 800)
        assert.ok(
            r.natives.some((n: any) => n.event === "orientation:change"),
            "no native orientation change",
        )
        for (const n of r.notifications.filter(
            (n: any) => n.state === "screen",
        ))
            assert.equal(
                n.value.orientationType === "landscape-primary",
                n.value.width >= n.value.height,
            )
    },
)

await step(
    "synthetic resize/orientation/screen events with nothing changed notify nobody",
    () => call("syntheticEvents"),
    r => assert.deepEqual(r.notifications, []),
)

await step(
    "clear emulation: back to the real window and screen",
    () => page("Emulation.clearDeviceMetricsOverride"),
    r => {
        assert.equal(r.first.size.innerWidth, r.live.innerWidth)
        assert.equal(r.first.screen.devicePixelRatio, r.live.devicePixelRatio)
        assert.equal(r.attached["resolution:change"], 2)
    },
)

const { windowId } = await send("Browser.getWindowForTarget", { targetId })
await step(
    "resize the browser window itself (Browser.setWindowBounds 900x700)",
    () =>
        send("Browser.setWindowBounds", {
            windowId,
            bounds: { width: 900, height: 700, windowState: "normal" },
        }),
    r => {
        assert.equal(r.first.size.innerWidth, r.live.innerWidth)
        assert.equal(r.first.size.innerHeight, r.live.innerHeight)
        assert.ok(
            count(r, "first", "window") >= 1,
            "the window resize did not publish",
        )
        assert.equal(
            count(r, "first", "screen"),
            0,
            "a window resize notified the screen",
        )
    },
)
const bounds = steps.at(-1) as any
evidence.outerSizeStaleAtResize = {
    published: [bounds.first.size.outerWidth, bounds.first.size.outerHeight],
    live: [bounds.live.outerWidth, bounds.live.outerHeight],
    atEvent: bounds.natives
        .filter((n: any) => n.event === "window:resize")
        .map((n: any) => n.outer),
}
evidence.steps = steps

const released = await call("release")
evidence.released = released
check("unsubscribe and dispose release every listener", () => {
    assert.deepEqual(released.afterUnsubscribe, {})
    assert.notDeepEqual(released.beforeDispose, {})
    assert.deepEqual(released.afterDispose, {})
})

socket.close()
browser.kill()
await browser.exited
server.stop(true)
rmSync(profile, { recursive: true, force: true })

evidence.problems = problems
const json = JSON.stringify(evidence, null, 2)
if (process.env.OUT) await Bun.write(process.env.OUT, json)
for (const s of steps)
    console.log(
        `• ${s.label}: ${(s.notifications as unknown[]).length} notifications, natives ${JSON.stringify((s.natives as any[]).map(n => n.event))}`,
    )
if (problems.length > 0) {
    console.error(`FAIL (${version.product})\n- ${problems.join("\n- ")}`)
    process.exit(1)
}
console.log(
    `observed: outer size at resize ${JSON.stringify(evidence.outerSizeStaleAtResize)}`,
)
console.log(
    `PASS (${version.product}, ${evidence.headless ? "headless" : "headed"}, real zoom ${evidence.realZoom ? "exercised" : "skipped"})`,
)
