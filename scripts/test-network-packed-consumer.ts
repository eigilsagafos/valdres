/**
 * Packed-consumer gate for the network packages: `@valdres/public-ip` and
 * `@valdres/bandwidth`.
 *
 * Same mechanics as the other lane gates — shadow-stage `dist`, the
 * repository's real `scripts/prepack.ts`, `npm pack`, an isolated
 * `npm install` — so it proves the *installed artifacts*, not workspace source:
 *
 * - under Node AND Bun, each with the default and the `development` export
 *   condition: import, dormant reads, subscriptions and React server rendering
 *   (through the packed `valdres-react`) make no request; explicit requests and
 *   measurements against a scripted in-process `fetch` (nothing leaves the
 *   machine; documentation-range addresses only) publish coherent state to
 *   every store; sharing, `fresh` replacement, newest-wins ordering,
 *   cancellation, disposal, transactions, subscriber-failure reporting,
 *   unsupported runtimes and read-only rejection;
 * - with a DOM-shaped host: import and subscriptions attach no listener to
 *   window, document or navigator.connection;
 * - packed declarations, with and without the DOM library;
 * - all of the above against BOTH the packed workspace core + React and the
 *   published pair at the declared peer floor (`NETWORK_FLOOR`), and that the
 *   core just below the floor cannot even load the packages;
 * - peer floors through a real semver implementation, and that no source
 *   manifest changed.
 *
 *   bun run scripts/test-network-packed-consumer.ts
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { gzipSync } from "node:zlib"
import {
    NETWORK_BELOW_FLOOR,
    NETWORK_CORE_PEER_RANGE as PEER,
    NETWORK_FLOOR,
    NETWORK_PACKAGES,
} from "./lib/network-packages"

const ROOT = join(import.meta.dir, "..")
const run = (
    label: string,
    command: readonly string[],
    cwd: string,
    env?: Record<string, string>,
) => {
    const result = spawnSync(command[0]!, command.slice(1), {
        cwd,
        encoding: "utf8",
        env: { ...process.env, ...env },
    })
    if (result.status !== 0) {
        console.error(
            `\n--- ${label} failed (exit ${result.status}) ---\n${result.stdout}\n${result.stderr}`,
        )
        process.exit(1)
    }
    return result
}

const dirs: Record<string, string> = {
    valdres: join(ROOT, "packages", "valdres"),
    "valdres-react": join(ROOT, "packages", "valdres-react"),
    ...Object.fromEntries(
        NETWORK_PACKAGES.map(pkg => [pkg.name, join(ROOT, pkg.dir)]),
    ),
}
const laneNames = NETWORK_PACKAGES.map(pkg => pkg.name)

const workspace = await mkdtemp(join(tmpdir(), "valdres-network-packed-"))
const stage = join(workspace, "stage")
const artifacts = join(workspace, "artifacts")
const consumer = join(workspace, "consumer")
await mkdir(join(stage, "scripts"), { recursive: true })
await mkdir(artifacts, { recursive: true })
await mkdir(consumer, { recursive: true })
for (const file of ["prepack.ts", "publish-metadata.ts"])
    await cp(join(ROOT, "scripts", file), join(stage, "scripts", file))
console.log(`workspace: ${workspace}`)

for (const [name, dir] of Object.entries(dirs)) {
    run(`build ${name}`, ["bun", "run", "build"], dir)
    run(`build ${name} types`, ["bun", "run", "build:types"], dir)
}

const before = new Map<string, string>()
for (const [name, dir] of Object.entries(dirs))
    before.set(name, await readFile(join(dir, "package.json"), "utf8"))

const packed = new Map<
    string,
    { tarball: string; staged: string; manifest: any; files: string[] }
>()
for (const [name, dir] of Object.entries(dirs)) {
    const staged = join(stage, "packages", name)
    await mkdir(staged, { recursive: true })
    await cp(join(dir, "dist"), join(staged, "dist"), { recursive: true })
    const manifest = JSON.parse(before.get(name)!)
    delete manifest.gitHead
    await writeFile(
        join(staged, "package.json"),
        JSON.stringify(manifest, null, 4),
    )
    run(
        `prepack ${name}`,
        ["bun", "run", join(stage, "scripts", "prepack.ts")],
        staged,
    )
    const prepacked = JSON.parse(
        await readFile(join(staged, "package.json"), "utf8"),
    )
    assert.equal(prepacked.scripts, undefined, `${name} shipped scripts`)
    assert.equal(
        prepacked.devDependencies,
        undefined,
        `${name} shipped devDependencies`,
    )
    for (const [subpath, entry] of Object.entries(
        prepacked.exports as Record<string, any>,
    ))
        for (const target of [entry.types, entry.import ?? entry.default])
            assert.ok(
                statSync(join(staged, target), { throwIfNoEntry: false }),
                `${name} ${subpath} -> missing ${target}`,
            )
    const result = run(
        `npm pack ${name}`,
        [
            "npm",
            "pack",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            artifacts,
        ],
        staged,
        { npm_config_loglevel: "error" },
    )
    const [entry] = JSON.parse(result.stdout)
    packed.set(name, {
        tarball: join(artifacts, basename(entry.filename)),
        staged,
        manifest: prepacked,
        files: entry.files.map((f: any) => f.path),
    })
}
for (const [name, dir] of Object.entries(dirs))
    assert.equal(
        await readFile(join(dir, "package.json"), "utf8"),
        before.get(name),
        `${name}/package.json changed`,
    )
console.log("manifests byte-identical after staging: ok")

const coreVersion = packed.get("valdres")!.manifest.version
for (const name of laneNames) {
    const { manifest, files } = packed.get(name)!
    assert.ok(!files.some(f => f.includes(".test.")), `${name} shipped tests`)
    assert.ok(
        !files.some(
            f =>
                f.startsWith("src/") ||
                f.startsWith("test/") ||
                f.startsWith("dev/"),
        ),
        `${name} shipped sources`,
    )
    assert.ok(
        !JSON.stringify(manifest).includes("workspace:"),
        `${name} shipped a workspace: range`,
    )
    assert.deepEqual(
        manifest.peerDependencies,
        { valdres: PEER },
        `${name} peer floor`,
    )
    assert.equal(
        manifest.dependencies,
        undefined,
        `${name} gained dependencies`,
    )
    console.log(
        `${name}: ${files.length} files, exports ${JSON.stringify(manifest.exports)}`,
    )
}
assert.equal(
    Bun.semver.satisfies(coreVersion, PEER),
    true,
    `packed core ${coreVersion} outside ${PEER}`,
)
assert.equal(Bun.semver.satisfies(NETWORK_BELOW_FLOOR, PEER), false)
assert.equal(Bun.semver.satisfies("2.0.0", PEER), false)
console.log(
    `peer ${PEER} admits packed core ${coreVersion}, rejects ${NETWORK_BELOW_FLOOR} and 2.0.0: ok`,
)

/** A scripted fetch shared by the runtime fixtures: every call waits for the
 *  fixture to answer it; nothing leaves the process. */
const SCRIPTED_FETCH = `
const calls = []
let ignoreAbort = false
const scripted = (input, init) => {
    let answer, fail, settled = false
    const promise = new Promise((resolve, reject) => { answer = resolve; fail = reject })
    const call = {
        url: String(input), init, signal: init?.signal,
        respond: (body, status = 200) => { if (settled) return; settled = true; answer({ ok: status < 300, status, text: async () => body }) },
        fail: error => { if (settled) return; settled = true; fail(error) },
    }
    init?.signal?.addEventListener("abort", () => { if (!ignoreAbort && !settled) { settled = true; fail(init.signal.reason) } })
    calls.push(call)
    return promise
}
globalThis.fetch = scripted
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setTimeout(resolve, 0)) }
const reported = []
globalThis.reportError = error => reported.push(error)
`

const RUNTIME = `import { strict as assert } from "node:assert"
${SCRIPTED_FETCH}
const { atom, store } = await import("valdres")
const { Provider, useValue } = await import("valdres-react")
const { createElement } = await import("react")
const { renderToString } = await import("react-dom/server")
const ip = await import("@valdres/public-ip")
const bw = await import("@valdres/bandwidth")
for (const name of ["public-ip", "bandwidth"])
    assert.match(import.meta.resolve("@valdres/" + name), new RegExp("node_modules/@valdres/" + name + "/dist/"))
assert.equal(typeof globalThis.window, "undefined")
assert.deepEqual(calls, [], "importing requested something")

// Dormant reads, subscriptions and a server render request nothing.
const root = store(), child = root.scope(), other = store()
assert.deepEqual(root.get(ip.publicIpAtom), { status: "idle", ip: null, updatedAt: null, error: null })
assert.deepEqual(root.get(bw.bandwidthAtom), { status: "idle", phase: null, progress: null, result: null, error: null })
const seen = { root: [], child: [], other: [] }
for (const [key, target] of [["root", root], ["child", child], ["other", other]])
    target.sub(ip.publicIpAtom, () => seen[key].push(target.get(ip.publicIpStatusAtom)))
child.sub(bw.bandwidthAtom, () => {})
const View = () => createElement("p", null, [useValue(ip.publicIpStatusAtom), useValue(ip.publicIpValueAtom) ?? "-", useValue(bw.measurementStatusAtom), useValue(bw.downloadSpeedAtom) ?? "-"].join("|"))
const render = () => { const request = store(); try { return renderToString(createElement(Provider, { store: request }, createElement(View))) } finally { request.dispose() } }
assert.equal(render(), "<p>idle|-|idle|-</p>")
assert.deepEqual(calls, [], "reads, subscriptions or a server render requested something")

// One shared request, published synchronously to every store tree.
const first = ip.requestPublicIp(), joined = ip.requestPublicIp({ endpoints: ["https://ip.test/ignored"] })
assert.equal(calls.length, 1)
assert.equal(calls[0].url, "https://api.ipify.org")
assert.equal(calls[0].init.referrerPolicy, "no-referrer")
assert.equal(other.get(ip.publicIpStatusAtom), "pending")
calls[0].respond("203.0.113.7\\n")
assert.deepEqual(await Promise.all([first, joined]), ["203.0.113.7", "203.0.113.7"])
for (const key of ["root", "child", "other"]) assert.deepEqual(seen[key], ["pending", "ready"], key)
assert.ok(Object.isFrozen(root.get(ip.publicIpAtom)))
assert.equal(store().get(ip.publicIpValueAtom), "203.0.113.7")
assert.equal(render(), "<p>idle|-|idle|-</p>", "a server render must stay on the seed")

// fresh replaces; the replaced response arriving late changes nothing.
ignoreAbort = true
const old = ip.requestPublicIp({ family: "v4" })
const newer = ip.requestPublicIp({ family: "v4", fresh: true })
calls[2].respond("198.51.100.23")
assert.equal(await newer, "198.51.100.23")
calls[1].respond("203.0.113.99")
assert.equal(await old.catch(error => error.name), "AbortError")
await flush()
assert.equal(root.get(ip.publicIpV4ValueAtom), "198.51.100.23")
ignoreAbort = false

// Cancelling the only caller aborts the request and restores the state.
const before = root.get(ip.publicIpAtom)
const controller = new AbortController()
const cancelled = ip.requestPublicIp({ signal: controller.signal })
controller.abort()
assert.equal(await cancelled.catch(error => error.name), "AbortError")
assert.equal(calls.at(-1).signal.aborted, true)
assert.equal(root.get(ip.publicIpAtom), before)

// A throwing subscriber is reported; the promise and the other stores are not affected.
const noisy = store()
noisy.sub(ip.publicIpV6Atom, () => { throw new Error("subscriber bug") })
const v6 = ip.requestPublicIp({ family: "v6" })
calls.at(-1).respond("2001:db8::7")
assert.equal(await v6, "2001:db8::7")
await flush()
assert.ok(reported.length >= 2 && reported.every(error => error.name === "SubscriberNotificationError"))
noisy.dispose()

// A request made inside a transaction reaches that store once it is over.
const trigger = atom(0)
const failing = ip.requestPublicIp({ endpoints: ["https://ip.test/a"] })
root.txn(tx => { tx.set(trigger, 1) })
calls.at(-1).respond("not an address")
const failure = await failing.catch(error => error)
assert.ok(failure instanceof AggregateError)
assert.deepEqual(root.get(ip.publicIpAtom), { ...before, status: "error", error: { name: "AggregateError", message: "Every public IP endpoint failed: https://ip.test/a did not return an IP address" } })
let inside
root.txn(tx => { tx.set(trigger, 2); inside = ip.requestPublicIp() })
await flush()
assert.equal(root.get(ip.publicIpStatusAtom), "pending")
calls.at(-1).respond("203.0.113.7")
await inside

// A disposed store receives nothing; fetchPublicIp publishes nothing.
let disposedCalls = 0
const doomed = store()
doomed.sub(ip.publicIpAtom, () => disposedCalls++)
const late = ip.requestPublicIp()
disposedCalls = 0
doomed.dispose()
calls.at(-1).respond("203.0.113.8")
await late
assert.equal(disposedCalls, 0)
const statelessBefore = root.get(ip.publicIpAtom)
const stateless = ip.fetchPublicIp({ family: "v6" })
calls.at(-1).respond("2001:db8::8")
assert.equal(await stateless, "2001:db8::8")
assert.equal(root.get(ip.publicIpAtom), statelessBefore)

// A shortened bandwidth measurement against in-process bodies.
const requestsBefore = calls.length
globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    await new Promise(resolve => setTimeout(resolve, 1))
    if (init?.signal?.aborted) throw init.signal.reason
    const bytes = Math.min(Number(/bytes=(\\d+)/.exec(String(input))?.[1] ?? 0), 65536)
    return new Response(new Uint8Array(bytes))
}
const phases = []
child.sub(bw.bandwidthAtom, () => { const { status, phase } = child.get(bw.bandwidthAtom); const label = phase ? status + "/" + phase : status; if (phases.at(-1) !== label) phases.push(label) })
const result = await bw.measureBandwidth({ latencySamples: 2, maxDurationMs: 120, minDurationMs: 60, warmupMs: 0, startStreams: 1, maxStreams: 1 })
assert.deepEqual(phases, ["pending/latency", "pending/download", "pending/upload", "ready"])
assert.equal(root.get(bw.bandwidthAtom).result, result)
assert.ok(result.downloadMbps > 0 && result.uploadMbps > 0 && result.latencyMs > 0)
assert.equal(root.get(bw.downloadSpeedAtom), result.downloadMbps)
assert.ok(calls.slice(requestsBefore).every(call => call.url.startsWith("https://speed.cloudflare.com/")))
const stop = new AbortController()
const aborted = bw.measureBandwidth({ signal: stop.signal, latencySamples: 2, maxDurationMs: 2000, minDurationMs: 1000, warmupMs: 0, startStreams: 1, maxStreams: 1 })
setTimeout(() => stop.abort(), 30)
assert.equal(await aborted.catch(error => error.name), "AbortError")
assert.equal(root.get(bw.bandwidthAtom).result, result, "a cancelled measurement must leave the previous result")
assert.equal(root.get(bw.measurementStatusAtom), "ready")

// Without fetch (sampled by a store that holds no subscription): unsupported,
// and the operations reject without publishing.
const saved = globalThis.fetch
delete globalThis.fetch
const bare = store()
assert.equal(bare.get(ip.publicIpStatusAtom), "unsupported")
assert.equal(bare.get(bw.measurementStatusAtom), "unsupported")
assert.equal(await ip.requestPublicIp().catch(error => error.name), "NotSupportedError")
assert.equal(await bw.measureBandwidth().catch(error => error.name), "NotSupportedError")
globalThis.fetch = saved
assert.equal(bare.get(bw.measurementStatusAtom), "ready")
bare.dispose()

for (const call of [
    () => root.set(ip.publicIpAtom, null), () => root.reset(ip.publicIpValueAtom),
    () => root.set(bw.bandwidthAtom, null), () => root.update(bw.downloadSpeedAtom, v => v),
]) assert.throws(call, TypeError)
assert.throws(() => ip.requestPublicIp({ endpoints: [] }), TypeError)
assert.throws(() => bw.measureBandwidth({ maxStreams: 0 }), TypeError)
for (const target of [root, other]) target.dispose()
console.log("RUNTIME_OK")
`

const DOM = `import { strict as assert } from "node:assert"
// A DOM-shaped host on plain EventTargets: nothing may attach to it.
const added = []
const spy = (label, target) => {
    const add = target.addEventListener.bind(target)
    target.addEventListener = (type, ...rest) => { added.push(label + ":" + type); return add(type, ...rest) }
    return target
}
globalThis.window = spy("window", new EventTarget())
globalThis.document = spy("document", new EventTarget())
Object.defineProperty(globalThis.navigator, "connection", { configurable: true, value: spy("connection", new EventTarget()) })
const calls = []
globalThis.fetch = input => { calls.push(String(input)); return new Promise(() => {}) }
const { store } = await import("valdres")
const ip = await import("@valdres/public-ip")
const bw = await import("@valdres/bandwidth")
const app = store()
const stops = [app.sub(ip.publicIpAtom, () => {}), app.scope().sub(ip.publicIpV4ValueAtom, () => {}), app.sub(bw.bandwidthAtom, () => {})]
for (const type of ["online", "focus"]) window.dispatchEvent(new Event(type))
document.dispatchEvent(new Event("visibilitychange"))
navigator.connection.dispatchEvent(new Event("change"))
await new Promise(resolve => setTimeout(resolve, 20))
assert.deepEqual([added, calls], [[], []], "import, subscriptions or browser events did work")
void ip.requestPublicIp()
void bw.measureBandwidth().catch(() => {})
assert.deepEqual(calls, ["https://api.ipify.org", "https://speed.cloudflare.com/__down?bytes=0"])
for (const stop of stops) stop()
app.dispose()
console.log("DOM_OK")
process.exit(0)
`

const typesSource = (
    dom: boolean,
) => `import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    fetchPublicIp, publicIpAtom, publicIpValueAtom, publicIpV6StatusAtom, requestPublicIp,
    type PublicIpError, type PublicIpRequestOptions, type PublicIpState, type PublicIpStatus,
} from "@valdres/public-ip"
import {
    bandwidthAtom, downloadSpeedAtom, measureBandwidth, measurementStatusAtom,
    type BandwidthResult, type BandwidthState, type MeasureBandwidthOptions, type MeasurementStatus,
} from "@valdres/bandwidth"
const app: Store = store()
const state: ExternalAtom<PublicIpState> = publicIpAtom
const value: Selector<string | null> = publicIpValueAtom
const status: Selector<PublicIpStatus> = publicIpV6StatusAtom
const error: PublicIpError | null = app.get(state).error
const options: PublicIpRequestOptions = { family: "v6", endpoints: ["https://ip.test"], timeoutMs: 1000, fresh: true }
const lookups: [Promise<string>, Promise<string>] = [requestPublicIp(options), fetchPublicIp()]
const measurement: ExternalAtom<BandwidthState> = bandwidthAtom
const download: Selector<number | null> = downloadSpeedAtom
const measuredStatus: Selector<MeasurementStatus> = measurementStatusAtom
const measureOptions: MeasureBandwidthOptions = { latencySamples: 3, maxStreams: 2 }
const result: Promise<BandwidthResult> = measureBandwidth(measureOptions)
${
    dom
        ? `const signal: AbortSignal = new AbortController().signal
void requestPublicIp({ signal })
void measureBandwidth({ signal, fresh: true })
`
        : ""
}// @ts-expect-error packed declarations keep the state read-only
app.set(publicIpAtom, app.get(publicIpAtom))
// @ts-expect-error packed declarations keep the state read-only
app.reset(downloadSpeedAtom)
// @ts-expect-error snapshots are read-only
app.get(bandwidthAtom).status = "ready"
// @ts-expect-error requests are not tied to a Store
void requestPublicIp(app)
void [state, value, status, error, lookups, measurement, download, measuredStatus, result]
`

/**
 * Installs the packed tarballs next to one core + React pair and runs every
 * consumer check against it. `core` and `react` are npm specs: the packed
 * workspace tarballs, or published versions from the registry.
 */
const checkConsumer = async (label: string, core: string, react: string) => {
    const dir = join(consumer, label.replace(/[^a-z0-9.-]+/gi, "-"))
    await mkdir(dir, { recursive: true })
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify(
            {
                name: "valdres-network-packed-consumer",
                private: true,
                type: "module",
                dependencies: {
                    ...Object.fromEntries(
                        laneNames.map(name => [
                            name,
                            `file:${packed.get(name)!.tarball}`,
                        ]),
                    ),
                    valdres: core,
                    "valdres-react": react,
                    react: "19.1.1",
                    "react-dom": "19.1.1",
                    "@types/react": "19.1.12",
                },
            },
            null,
            2,
        ),
    )
    run(
        `install consumer (${label})`,
        ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"],
        dir,
    )
    const installed = JSON.parse(
        await readFile(join(dir, "node_modules/valdres/package.json"), "utf8"),
    ).version
    assert.equal(
        Bun.semver.satisfies(installed, PEER),
        true,
        `${label}: installed core ${installed} outside ${PEER}`,
    )
    await writeFile(join(dir, "runtime.mjs"), RUNTIME)
    await writeFile(join(dir, "dom.mjs"), DOM)
    const outputs: string[] = []
    for (const runtime of ["node", "bun"])
        for (const conditions of [[], ["--conditions=development"]])
            for (const script of ["runtime.mjs", "dom.mjs"]) {
                const name = `${runtime}${conditions.length ? " (development)" : ""}`
                outputs.push(
                    `${name}:${run(`${script} (${label}, ${name})`, [runtime, ...conditions, script], dir).stdout.trim()}`,
                )
            }
    for (const [kind, dom] of [
        ["dom", true],
        ["server", false],
    ] as const) {
        await writeFile(join(dir, `types-${kind}.ts`), typesSource(dom))
        await writeFile(
            join(dir, `tsconfig.${kind}.json`),
            JSON.stringify(
                {
                    compilerOptions: {
                        target: "ESNext",
                        module: "ESNext",
                        moduleResolution: "bundler",
                        lib: dom ? ["ESNext", "DOM"] : ["ESNext"],
                        types: [],
                        strict: true,
                        noEmit: true,
                        skipLibCheck: false,
                    },
                    include: [`types-${kind}.ts`],
                },
                null,
                2,
            ),
        )
        run(
            `typescript consumer (${label}, ${kind})`,
            [
                join(ROOT, "node_modules", ".bin", "tsgo"),
                "--noEmit",
                "-p",
                `tsconfig.${kind}.json`,
            ],
            dir,
        )
    }
    console.log(
        `${label} (valdres@${installed}): ${outputs.join(", ")}, TYPES_OK with and without the DOM library`,
    )
}

await checkConsumer(
    "packed head",
    `file:${packed.get("valdres")!.tarball}`,
    `file:${packed.get("valdres-react")!.tarball}`,
)
// The declared floor, against the artifacts actually published for it.
await checkConsumer(
    `published floor ${NETWORK_FLOOR.valdres}`,
    NETWORK_FLOOR.valdres,
    NETWORK_FLOOR["valdres-react"],
)

// Just below the floor the packages cannot load at all: proof the floor is a
// requirement, not a copied range.
{
    const dir = join(consumer, "below-floor")
    await mkdir(dir, { recursive: true })
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
            name: "valdres-network-below-floor",
            private: true,
            type: "module",
            dependencies: {
                ...Object.fromEntries(
                    laneNames.map(name => [
                        name,
                        `file:${packed.get(name)!.tarball}`,
                    ]),
                ),
                valdres: NETWORK_BELOW_FLOOR,
            },
        }),
    )
    run(
        "install below-floor consumer",
        [
            "npm",
            "install",
            "--no-audit",
            "--no-fund",
            "--loglevel=error",
            "--legacy-peer-deps",
        ],
        dir,
    )
    for (const name of laneNames) {
        const result = spawnSync(
            "node",
            [
                "--input-type=module",
                "-e",
                `await import(${JSON.stringify(name)})`,
            ],
            { cwd: dir, encoding: "utf8" },
        )
        assert.notEqual(
            result.status,
            0,
            `${name} loaded against valdres@${NETWORK_BELOW_FLOOR}`,
        )
        assert.match(
            result.stderr,
            /externalAtom/,
            `${name} failed below the floor for another reason:\n${result.stderr}`,
        )
    }
    console.log(
        `below floor (valdres@${NETWORK_BELOW_FLOOR}): both packages fail to load (no externalAtom): ok`,
    )
}

for (const name of laneNames) {
    const dist = join(packed.get(name)!.staged, "dist", "index.js")
    const minified = join(workspace, `${basename(name)}.min.js`)
    run(
        "minify",
        [
            "bun",
            "build",
            dist,
            "--minify",
            "--packages",
            "external",
            "--outfile",
            minified,
        ],
        workspace,
    )
    console.log(
        `size ${name}: tarball ${statSync(packed.get(name)!.tarball).size} B, min+gzip ${gzipSync(await readFile(minified)).length} B (valdres external)`,
    )
}
console.log(`PACKED_OK against valdres@${coreVersion}`)
await rm(workspace, { recursive: true, force: true })
