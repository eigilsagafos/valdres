/**
 * Packed-consumer gate for the browser-permission packages:
 * `@valdres/browser-device-motion`, `-device-orientation`, `-geolocation` and
 * `-screen-details`.
 *
 * Same mechanics as the browser-status gate — shadow-stage `dist`, the
 * repository's real `scripts/prepack.ts`, `npm pack`, an isolated
 * `npm install` — so it proves the *installed artifacts*, not workspace source:
 *
 * - browserless import, dormant reads, no-op subscriptions, inert request
 *   functions and read-only rejection, under Node AND Bun, plus React server
 *   rendering of the seeds through the packed `valdres-react`;
 * - against a DOM-shaped host on plain EventTargets with scripted permission
 *   and hardware outcomes (no real sensor or location is ever touched):
 *   import and reads do nothing, subscriptions never prompt, one shared
 *   listener per window for motion/orientation, permission requests made
 *   synchronously inside a modelled user activation, per-Store geolocation
 *   watches with their own options and the conflict error, and screen-details
 *   listeners that exist only while retained — all released on dispose;
 * - packed declarations, with and without the DOM library;
 * - all of the above against BOTH the packed workspace core + React and the
 *   published pair at the declared peer floor (`BROWSER_PERMISSION_FLOOR`);
 * - peer floors through a real semver implementation, and that no source
 *   manifest changed.
 *
 *   bun run scripts/test-browser-permission-packed-consumer.ts
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { gzipSync } from "node:zlib"
import {
    BROWSER_PERMISSION_CORE_PEER_RANGE as PEER,
    BROWSER_PERMISSION_FLOOR,
    BROWSER_PERMISSION_PACKAGES,
} from "./lib/browser-permission-packages"

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
        BROWSER_PERMISSION_PACKAGES.map(pkg => [pkg.name, join(ROOT, pkg.dir)]),
    ),
}
const laneNames = BROWSER_PERMISSION_PACKAGES.map(pkg => pkg.name)

const workspace = await mkdtemp(join(tmpdir(), "valdres-browser-permission-packed-"))
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
    await writeFile(join(staged, "package.json"), JSON.stringify(manifest, null, 4))
    run(`prepack ${name}`, ["bun", "run", join(stage, "scripts", "prepack.ts")], staged)
    const prepacked = JSON.parse(await readFile(join(staged, "package.json"), "utf8"))
    assert.equal(prepacked.scripts, undefined, `${name} shipped scripts`)
    assert.equal(prepacked.devDependencies, undefined, `${name} shipped devDependencies`)
    for (const [subpath, entry] of Object.entries(prepacked.exports as Record<string, any>))
        for (const target of [entry.types, entry.import ?? entry.default])
            assert.ok(
                statSync(join(staged, target), { throwIfNoEntry: false }),
                `${name} ${subpath} -> missing ${target}`,
            )
    const result = run(
        `npm pack ${name}`,
        ["npm", "pack", "--ignore-scripts", "--json", "--pack-destination", artifacts],
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
    assert.ok(!files.some(f => f.startsWith("src/") || f.startsWith("test/") || f.startsWith("dev/")), `${name} shipped sources`)
    assert.ok(!JSON.stringify(manifest).includes("workspace:"), `${name} shipped a workspace: range`)
    assert.deepEqual(manifest.peerDependencies, { valdres: PEER }, `${name} peer floor`)
    assert.equal(manifest.dependencies, undefined, `${name} gained dependencies`)
    console.log(`${name}: ${files.length} files, exports ${JSON.stringify(manifest.exports)}`)
}
assert.equal(Bun.semver.satisfies(coreVersion, PEER), true, `packed core ${coreVersion} outside ${PEER}`)
assert.equal(Bun.semver.satisfies("1.0.0-beta.38", PEER), false)
assert.equal(Bun.semver.satisfies("2.0.0", PEER), false)
console.log(`peer ${PEER} admits packed core ${coreVersion}, rejects beta.38 and 2.0.0: ok`)

const BROWSERLESS = `import { strict as assert } from "node:assert"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { store } from "valdres"
import { Provider, useValue } from "valdres-react"
import * as motion from "@valdres/browser-device-motion"
import * as orientation from "@valdres/browser-device-orientation"
import * as geo from "@valdres/browser-geolocation"
import * as screens from "@valdres/browser-screen-details"
assert.equal(typeof globalThis.window, "undefined")
assert.equal(globalThis.navigator?.geolocation, undefined)
for (const name of ["device-motion", "device-orientation", "geolocation", "screen-details"])
    assert.match(import.meta.resolve("@valdres/browser-" + name), new RegExp("node_modules/@valdres/browser-" + name + "/dist/"))
const app = store()
assert.deepEqual(
    [app.get(motion.motionStatusAtom), app.get(motion.permissionAtom), app.get(orientation.orientationStatusAtom), app.get(orientation.permissionAtom)],
    ["unsupported", "unsupported", "unsupported", "unsupported"],
)
assert.deepEqual(app.get(geo.geolocationAtom), { status: "unsupported", position: null, error: null })
assert.equal(app.get(geo.permissionAtom), "unsupported")
assert.deepEqual(app.get(screens.screenDetailsAtom), { status: "unsupported", screens: [], currentScreen: null, error: null })
const never = () => { throw new Error("a DOM-less source must never notify") }
for (const state of [motion.motionAtom, motion.permissionAtom, orientation.orientationAtom, geo.positionAtom, geo.permissionAtom, screens.screensAtom, screens.screenPermissionAtom])
    app.sub(state, never)()
assert.equal(await motion.requestMotionPermission(), "unsupported")
assert.equal(await orientation.requestOrientationPermission(), "unsupported")
assert.equal(await screens.requestScreenDetails(), null)
const stopWatch = geo.watchGeolocation(app)
assert.equal(app.get(geo.geolocationStatusAtom), "unsupported")
stopWatch()
for (const call of [
    () => app.set(motion.motionAtom, null), () => app.reset(orientation.permissionAtom),
    () => app.set(geo.positionAtom, null), () => app.update(screens.screenDetailsAtom, v => v),
]) assert.throws(call, TypeError)
const View = () => createElement("p", null, [
    useValue(motion.motionStatusAtom), useValue(motion.permissionAtom),
    useValue(orientation.orientationStatusAtom), useValue(geo.geolocationStatusAtom),
    useValue(geo.permissionAtom), useValue(screens.screenDetailsStatusAtom), useValue(screens.screenPermissionAtom),
].join("|"))
const render = () => { const request = store(); try { return renderToString(createElement(Provider, { store: request }, createElement(View))) } finally { request.dispose() } }
assert.equal(render(), "<p>idle|prompt|idle|idle|prompt|idle|prompt</p>")
assert.equal(render(), render())
app.dispose()
console.log("BROWSERLESS_OK")
`

const DOM = `import { strict as assert } from "node:assert"
// A DOM-shaped host on plain EventTargets with scripted permission and
// hardware outcomes; nothing here can reach a real sensor or location.
const log = []
const counts = new Map()
const win = new EventTarget()
const add = win.addEventListener.bind(win), remove = win.removeEventListener.bind(win)
const sets = new Map()
win.addEventListener = (type, l) => { const s = sets.get(type) ?? new Set(); sets.set(type, s); s.add(l); counts.set(type, s.size); add(type, l) }
win.removeEventListener = (type, l) => { const s = sets.get(type); s?.delete(l); counts.set(type, s?.size ?? 0); remove(type, l) }
const listeners = type => counts.get(type) ?? 0
let activation = 0
const withActivation = fn => { activation++; try { return fn() } finally { activation-- } }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const requests = []
const sensor = name => class extends Event {
    static requestPermission() {
        log.push(name + ":request:" + (activation > 0 ? "activated" : "no-activation"))
        if (activation === 0) return Promise.reject(new DOMException("needs activation", "NotAllowedError"))
        const d = deferred(); requests.push(d); return d.promise
    }
}
win.DeviceMotionEvent = sensor("motion")
win.DeviceOrientationEvent = sensor("orientation")
win.isSecureContext = true
class Screen extends EventTarget { constructor(label) { super(); Object.assign(this, { label, left: 0, top: 0, width: 1920, height: 1080, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24, devicePixelRatio: 1, orientation: { type: "landscape-primary", angle: 0 }, isPrimary: true, isInternal: true }) } }
const details = new EventTarget()
details.screens = [new Screen("Primary")]
details.currentScreen = details.screens[0]
let detailsListeners = 0
for (const target of [details, details.screens[0]]) {
    const a = target.addEventListener.bind(target), r = target.removeEventListener.bind(target)
    target.addEventListener = (t, l) => { detailsListeners++; a(t, l) }
    target.removeEventListener = (t, l) => { detailsListeners--; r(t, l) }
}
const screenRequests = []
win.getScreenDetails = () => { log.push("getScreenDetails:" + (activation > 0 ? "activated" : "no-activation")); const d = deferred(); screenRequests.push(d); return d.promise }
const watches = []
Object.defineProperty(globalThis.navigator, "geolocation", { configurable: true, value: {
    watchPosition: (success, error, options) => { log.push("watchPosition"); watches.push({ success, error, options, cleared: false }); return watches.length },
    clearWatch: id => { watches[id - 1].cleared = true },
    getCurrentPosition: () => { throw new Error("must not be called") },
} })
Object.defineProperty(globalThis.navigator, "permissions", { configurable: true, value: {
    query: ({ name }) => { log.push("query:" + name); return Promise.reject(new TypeError("unknown name")) },
} })
globalThis.window = win
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const { store, StoreDisposedError } = await import("valdres")
const motion = await import("@valdres/browser-device-motion")
const orientation = await import("@valdres/browser-device-orientation")
const geo = await import("@valdres/browser-geolocation")
const screens = await import("@valdres/browser-screen-details")
assert.deepEqual([log, [...counts.values()].filter(Boolean)], [[], []], "importing did work")

const first = store(), second = store(), child = first.scope()
assert.deepEqual([first.get(motion.motionStatusAtom), first.get(motion.permissionAtom), first.get(geo.geolocationStatusAtom), first.get(screens.screenDetailsStatusAtom)], ["idle", "prompt", "idle", "idle"])
assert.deepEqual(log, [], "dormant reads did work")

// Motion + orientation: one shared listener per window, never a prompt.
const seen = []
const stops = [
    first.sub(motion.motionAtom, () => seen.push("first")),
    second.sub(motion.accelerationSelector, () => seen.push("second")),
    child.sub(orientation.alphaSelector, () => {}),
]
assert.deepEqual([listeners("devicemotion"), listeners("deviceorientation")], [1, 1])
const reading = Object.assign(new Event("devicemotion"), { acceleration: { x: 1, y: 2, z: 3 }, accelerationIncludingGravity: null, rotationRate: null, interval: 16 })
win.dispatchEvent(reading)
assert.deepEqual(seen, ["first", "second"])
assert.deepEqual(second.get(motion.accelerationSelector), { x: 1, y: 2, z: 3 })
assert.equal(log.filter(entry => entry.includes("request")).length, 0, "subscribing prompted")

// Permission requests: synchronous inside the activation, page-wide answers.
assert.equal(await motion.requestMotionPermission(), "prompt", "an activation-less request records nothing")
const granted = withActivation(() => motion.requestMotionPermission())
requests.shift().resolve("granted")
assert.equal(await granted, "granted")
assert.equal(second.get(motion.permissionAtom), "granted")
const denied = withActivation(() => orientation.requestOrientationPermission())
requests.shift().resolve("denied")
assert.equal(await denied, "denied")
assert.equal(first.get(orientation.permissionAtom), "denied")

// Geolocation: per-Store watches with their own options, explicit only.
const watchesBefore = watches.length
first.sub(geo.positionAtom, () => {})
assert.equal(watches.length, watchesBefore, "subscribing started a watch")
const stopFirst = withActivation(() => geo.watchGeolocation(first, { enableHighAccuracy: true }))
const stopSecond = geo.watchGeolocation(second, { maximumAge: 60000 })
assert.deepEqual(watches.map(w => [w.options.enableHighAccuracy, w.options.maximumAge]), [[true, 0], [false, 60000]])
assert.throws(() => geo.watchGeolocation(first), geo.GeolocationWatchConflictError)
watches[0].success({ coords: { latitude: 1, longitude: 2, accuracy: 3, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: 0 })
assert.deepEqual([first.get(geo.coordsSelector), child.get(geo.coordsSelector), second.get(geo.coordsSelector)], [{ latitude: 1, longitude: 2 }, { latitude: 1, longitude: 2 }, null])
stopSecond()
assert.equal(watches[1].cleared, true)

// Screen details: explicit request, listeners only while retained and granted.
first.sub(screens.screensAtom, () => {})
assert.equal(screenRequests.length, 0)
const answer = withActivation(() => screens.requestScreenDetails())
assert.equal(first.get(screens.screenDetailsStatusAtom), "pending")
screenRequests.shift().resolve(details)
assert.equal((await answer).length, 1)
assert.equal(second.get(screens.screenDetailsStatusAtom), "ready")
assert.equal(detailsListeners, 3)

await flush()
assert.deepEqual(log.filter(entry => entry.startsWith("query:")).sort(), [])
first.dispose()
assert.equal(watches[0].cleared, true, "dispose left a watch running")
assert.equal(detailsListeners, 0, "dispose left screen listeners")
assert.equal(listeners("deviceorientation"), 0)
assert.equal(listeners("devicemotion"), 1, "second still listens")
assert.throws(() => geo.watchGeolocation(first), StoreDisposedError)
stopFirst()
for (const stop of stops) stop()
second.dispose()
assert.deepEqual([listeners("devicemotion"), listeners("deviceorientation")], [0, 0])
assert.ok(log.every(entry => !entry.includes("no-activation") || entry.startsWith("motion")), log.join(","))
console.log("DOM_OK")
`

const typesSource = (dom: boolean) => `import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import { motionAtom, permissionAtom as motionPermission, requestMotionPermission, type MotionSnapshot, type MotionStatus } from "@valdres/browser-device-motion"
import { orientationAtom, requestOrientationPermission, type OrientationSnapshot } from "@valdres/browser-device-orientation"
import { geolocationAtom, positionAtom, watchGeolocation, GeolocationWatchConflictError, type GeolocationState, type GeolocationWatchOptions } from "@valdres/browser-geolocation"
import { screenDetailsAtom, screensAtom, requestScreenDetails, type ScreenDetail, type ScreenDetailsState } from "@valdres/browser-screen-details"
const app: Store = store()
const motionState: Selector<MotionSnapshot | null> = motionAtom
const status: MotionStatus = "insecure"
const orientationState: Selector<OrientationSnapshot | null> = orientationAtom
const geoState: Selector<GeolocationState> = geolocationAtom
const options: GeolocationWatchOptions = { enableHighAccuracy: true, timeout: Infinity }
const stop: () => void = watchGeolocation(app, options)
const conflict: Error = new GeolocationWatchConflictError({ enableHighAccuracy: false, timeout: 1, maximumAge: 0 }, { enableHighAccuracy: true, timeout: 1, maximumAge: 0 })
const details: ExternalAtom<ScreenDetailsState> = screenDetailsAtom
const list: readonly ScreenDetail[] = app.get(screensAtom)
const requests: [Promise<string>, Promise<string>, Promise<ScreenDetail[] | null>] = [requestMotionPermission(), requestOrientationPermission(), requestScreenDetails()]
// @ts-expect-error packed declarations keep the state read-only
app.set(positionAtom, null)
// @ts-expect-error packed declarations keep the state read-only
app.reset(motionPermission)
// @ts-expect-error packed declarations keep the state read-only
app.set(screenDetailsAtom, app.get(screenDetailsAtom))
// @ts-expect-error watchGeolocation needs the store that owns the watch
watchGeolocation(options)
${dom ? `const orientationType: OrientationType = list[0]!.orientationType
void orientationType
` : ""}void [motionState, status, orientationState, geoState, stop, conflict, details, list, requests]
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
                name: "valdres-browser-permission-packed-consumer",
                private: true,
                type: "module",
                dependencies: {
                    ...Object.fromEntries(
                        laneNames.map(name => [name, `file:${packed.get(name)!.tarball}`]),
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
    run(`install consumer (${label})`, ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"], dir)
    const installed = JSON.parse(await readFile(join(dir, "node_modules/valdres/package.json"), "utf8")).version
    assert.equal(Bun.semver.satisfies(installed, PEER), true, `${label}: installed core ${installed} outside ${PEER}`)
    await writeFile(join(dir, "browserless.mjs"), BROWSERLESS)
    await writeFile(join(dir, "dom.mjs"), DOM)
    const outputs: string[] = []
    for (const runtime of ["node", "bun"])
        for (const script of ["browserless.mjs", "dom.mjs"])
            outputs.push(`${runtime}:${run(`${script} (${label}, ${runtime})`, [runtime, script], dir).stdout.trim()}`)
    for (const [kind, dom] of [["dom", true], ["server", false]] as const) {
        await writeFile(join(dir, `types-${kind}.ts`), typesSource(dom))
        await writeFile(
            join(dir, `tsconfig.${kind}.json`),
            JSON.stringify({
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
            }, null, 2),
        )
        run(
            `typescript consumer (${label}, ${kind})`,
            [join(ROOT, "node_modules", ".bin", "tsgo"), "--noEmit", "-p", `tsconfig.${kind}.json`],
            dir,
        )
    }
    console.log(`${label} (valdres@${installed}): ${outputs.join(", ")}, TYPES_OK with and without the DOM library`)
}

await checkConsumer(
    "packed head",
    `file:${packed.get("valdres")!.tarball}`,
    `file:${packed.get("valdres-react")!.tarball}`,
)
// The declared floor, against the artifacts actually published for it.
await checkConsumer(
    `published floor ${BROWSER_PERMISSION_FLOOR.valdres}`,
    BROWSER_PERMISSION_FLOOR.valdres,
    BROWSER_PERMISSION_FLOOR["valdres-react"],
)

for (const name of laneNames) {
    const dist = join(packed.get(name)!.staged, "dist", "index.js")
    const minified = join(workspace, `${basename(name)}.min.js`)
    run("minify", ["bun", "build", dist, "--minify", "--packages", "external", "--outfile", minified], workspace)
    console.log(
        `size ${name}: tarball ${statSync(packed.get(name)!.tarball).size} B, min+gzip ${gzipSync(await readFile(minified)).length} B (valdres external)`,
    )
}
console.log(`PACKED_OK against valdres@${coreVersion}`)
await rm(workspace, { recursive: true, force: true })
