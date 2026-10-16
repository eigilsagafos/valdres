/**
 * Packed-consumer gate for the browser-geometry packages:
 * `@valdres/browser-window` and `@valdres/browser-screen`.
 *
 * Same mechanics as the browser-status, keyboard and hotkeys gates —
 * shadow-stage `dist`, the repository's real `scripts/prepack.ts`, `npm pack`,
 * an isolated `npm install` — so it proves the *installed artifacts*, not
 * workspace source:
 *
 * - browserless import, frozen and identity-stable seeds, no-op subscriptions
 *   and read-only rejection in plain Node, plus deterministic React server
 *   rendering of the seeds through the packed `valdres-react`;
 * - against a DOM-shaped host built from plain EventTargets: import and dormant
 *   reads attach nothing and match no media; per-store-tree listeners (window:
 *   one `resize`; screen: `resize`, `screen.orientation` `change`, `screen`
 *   `change` and one resolution query), shared by child scopes; snapshots
 *   shared across stores; coherent rotation; equality suppression; the
 *   resolution watch following the ratio; dispose releasing everything;
 * - packed declarations, with and without the DOM library;
 * - all of the above against BOTH the packed workspace core + React and the
 *   published pair at the declared peer floor (`BROWSER_GEOMETRY_FLOOR`), plus
 *   any extra published pairs, so the floor is executed rather than inferred;
 * - peer floors through a real semver implementation, and that no source
 *   manifest changed.
 *
 *   bun run scripts/test-browser-geometry-packed-consumer.ts
 *   BROWSER_GEOMETRY_EXTRA_CORES=1.0.0-beta.44:1.0.0-beta.8 bun run scripts/test-browser-geometry-packed-consumer.ts
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { gzipSync } from "node:zlib"
import {
    BROWSER_GEOMETRY_CORE_PEER_RANGE as PEER,
    BROWSER_GEOMETRY_FLOOR,
    BROWSER_GEOMETRY_PACKAGES,
} from "./lib/browser-geometry-packages"

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

const nodeVersion = run(
    "node --version",
    ["node", "--version"],
    ROOT,
).stdout.trim()
console.log(`node ${nodeVersion}, bun ${Bun.version}`)

const dirs: Record<string, string> = {
    valdres: join(ROOT, "packages", "valdres"),
    "valdres-react": join(ROOT, "packages", "valdres-react"),
    ...Object.fromEntries(
        BROWSER_GEOMETRY_PACKAGES.map(pkg => [pkg.name, join(ROOT, pkg.dir)]),
    ),
}
const geometryNames = BROWSER_GEOMETRY_PACKAGES.map(pkg => pkg.name)

const workspace = await mkdtemp(
    join(tmpdir(), "valdres-browser-geometry-packed-"),
)
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
for (const name of geometryNames) {
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
        `${name} gained runtime dependencies`,
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
assert.equal(Bun.semver.satisfies("1.0.0-beta.38", PEER), false)
assert.equal(Bun.semver.satisfies("2.0.0", PEER), false)
console.log(
    `peer ${PEER} admits packed core ${coreVersion}, rejects beta.38 and 2.0.0: ok`,
)

const WINDOW_SEED = {
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0,
}
const SCREEN_SEED = {
    width: 0,
    height: 0,
    availWidth: 0,
    availHeight: 0,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1,
    orientationType: "landscape-primary",
    orientationAngle: 0,
}

const BROWSERLESS = `import { strict as assert } from "node:assert"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { windowSizeAtom } from "@valdres/browser-window"
import { screenAtom } from "@valdres/browser-screen"
assert.equal(typeof globalThis.window, "undefined")
assert.equal(typeof globalThis.screen, "undefined")
for (const name of ["window", "screen"])
    assert.match(import.meta.resolve("@valdres/browser-" + name), new RegExp("node_modules/@valdres/browser-" + name + "/dist/"))
const app = store(), other = store()
const size = app.get(windowSizeAtom), info = app.get(screenAtom)
assert.deepEqual(size, ${JSON.stringify(WINDOW_SEED)})
assert.deepEqual(info, ${JSON.stringify(SCREEN_SEED)})
assert.ok(Object.isFrozen(size) && Object.isFrozen(info))
assert.equal(other.get(windowSizeAtom), size, "seeds are one shared object")
assert.equal(other.get(screenAtom), info)
for (const state of [windowSizeAtom, screenAtom]) {
    const stop = app.sub(state, () => { throw new Error("a DOM-less source must never notify") })
    stop()
}
for (const call of [
    () => app.set(windowSizeAtom, size), () => app.reset(windowSizeAtom), () => app.update(windowSizeAtom, v => v),
    () => app.set(screenAtom, info), () => app.reset(screenAtom), () => app.update(screenAtom, v => v),
]) assert.throws(call, TypeError)
const View = () => {
    const s = useValue(windowSizeAtom), i = useValue(screenAtom)
    return createElement("p", null, [s.innerWidth, s.innerHeight, i.width, i.devicePixelRatio, i.orientationType].join("|"))
}
const render = () => { const request = store(); try { return renderToString(createElement(Provider, { store: request }, createElement(View))) } finally { request.dispose() } }
assert.equal(render(), "<p>0|0|0|1|landscape-primary</p>")
assert.equal(render(), render())
app.dispose(); other.dispose()
console.log("BROWSERLESS_OK")
`
const DOM = `import { strict as assert } from "node:assert"
// A DOM-shaped host on plain EventTargets, counting distinct listeners per target.
const registry = new Map()
const track = (name, target) => {
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target)
    const types = new Map()
    registry.set(target, { name, types })
    target.addEventListener = (type, l) => { if (!types.has(type)) types.set(type, new Set()); types.get(type).add(l); add(type, l) }
    target.removeEventListener = (type, l) => { types.get(type)?.delete(l); remove(type, l) }
}
const attached = () => {
    const counts = {}
    for (const { name, types } of registry.values())
        for (const [type, set] of types) if (set.size) counts[name + ":" + type] = (counts[name + ":" + type] ?? 0) + set.size
    return Object.fromEntries(Object.entries(counts).sort())
}
const host = {
    innerWidth: 1024, innerHeight: 768, outerWidth: 1040, outerHeight: 860,
    width: 1920, height: 1080, availWidth: 1920, availHeight: 1050, colorDepth: 24, pixelDepth: 24,
    ratio: 1, type: "landscape-primary", angle: 0,
}
const win = new EventTarget(), scr = new EventTarget(), orientation = new EventTarget()
for (const key of ["innerWidth", "innerHeight", "outerWidth", "outerHeight"]) Object.defineProperty(win, key, { get: () => host[key] })
Object.defineProperty(win, "devicePixelRatio", { get: () => host.ratio })
for (const key of ["width", "height", "availWidth", "availHeight", "colorDepth", "pixelDepth"]) Object.defineProperty(scr, key, { get: () => host[key] })
Object.defineProperty(orientation, "type", { get: () => host.type })
Object.defineProperty(orientation, "angle", { get: () => host.angle })
Object.defineProperty(scr, "orientation", { get: () => orientation })
win.screen = scr
const queries = []
win.matchMedia = query => {
    const at = Number(/resolution: ([0-9.]+)dppx/.exec(query)[1])
    const list = new EventTarget()
    Object.defineProperty(list, "matches", { get: () => host.ratio === at })
    list.media = query
    track("resolution", list)
    queries.push(list)
    return list
}
track("window", win); track("screen", scr); track("orientation", orientation)
globalThis.window = win
const fire = (target, type) => target.dispatchEvent(new Event(type))
const zoom = ratio => {
    const before = queries.map(q => q.matches)
    host.ratio = ratio
    queries.forEach((q, i) => { if (before[i] !== q.matches) fire(q, "change") })
}

const { store } = await import("valdres")
const { windowSizeAtom } = await import("@valdres/browser-window")
const { screenAtom } = await import("@valdres/browser-screen")
assert.deepEqual(attached(), {}, "import attached listeners")

const first = store(), second = store(), child = first.scope()
const size = first.get(windowSizeAtom), info = first.get(screenAtom)
assert.equal(size.innerWidth, 1024); assert.equal(info.availHeight, 1050)
assert.equal(second.get(windowSizeAtom), size, "stores share the unchanged snapshot")
assert.deepEqual(attached(), {}, "dormant reads attached listeners")
assert.equal(queries.length, 0, "a dormant read matched media")

const seen = []
const stops = [
    first.sub(windowSizeAtom, () => seen.push("first:window")),
    first.sub(screenAtom, () => seen.push("first:screen")),
    second.sub(windowSizeAtom, () => seen.push("second:window")),
    second.sub(screenAtom, () => seen.push("second:screen")),
    child.sub(screenAtom, () => seen.push("child:screen")),
]
assert.deepEqual(attached(), { "orientation:change": 2, "resolution:change": 2, "screen:change": 2, "window:resize": 4 })

// A window resize: window publishes; the unchanged screen does not.
host.innerWidth = 800; host.outerWidth = 816; fire(win, "resize")
assert.deepEqual(seen.splice(0).sort(), ["first:window", "second:window"])
assert.equal(first.get(windowSizeAtom), second.get(windowSizeAtom))
assert.equal(first.get(windowSizeAtom).outerWidth, 816)

// Nothing changed: nobody is notified.
fire(win, "resize"); fire(orientation, "change"); fire(scr, "change")
assert.deepEqual(seen, [])

// Zoom: the resolution watch fires, moves to the new ratio, and keeps one listener per tree.
zoom(2)
assert.deepEqual(seen.splice(0).sort(), ["child:screen", "first:screen", "second:screen"])
assert.equal(first.get(screenAtom).devicePixelRatio, 2)
assert.deepEqual(queries.map(q => q.media), ["(resolution: 1dppx)", "(resolution: 1dppx)", "(resolution: 2dppx)", "(resolution: 2dppx)"])
assert.equal(attached()["resolution:change"], 2)

// A rotation: every field moves, then both events fire. One coherent publication.
Object.assign(host, { width: 1080, height: 1920, availWidth: 1080, availHeight: 1890, type: "portrait-primary", angle: 90 })
fire(orientation, "change"); fire(win, "resize")
assert.deepEqual(seen.splice(0).sort(), ["child:screen", "first:screen", "second:screen"])
assert.deepEqual(
    [first.get(screenAtom).width, first.get(screenAtom).height, first.get(screenAtom).orientationType],
    [1080, 1920, "portrait-primary"],
)
assert.ok(Object.isFrozen(first.get(screenAtom)))

for (const stop of stops.splice(0, 4)) stop()
assert.deepEqual(attached(), { "orientation:change": 1, "resolution:change": 1, "screen:change": 1, "window:resize": 1 }, "the child scope keeps its root's attachment")
stops.push(second.sub(windowSizeAtom, () => {}))
first.dispose(); second.dispose()
assert.deepEqual(attached(), {}, "dispose left listeners behind")
console.log("DOM_OK")
`
const typesSource = (
    dom: boolean,
) => `import { store, type ExternalAtom } from "valdres"
import { windowSizeAtom, type WindowSize } from "@valdres/browser-window"
import { screenAtom, type ScreenInfo, type ScreenOrientationType } from "@valdres/browser-screen"
const app = store()
const sizeAtom: ExternalAtom<WindowSize> = windowSizeAtom
const infoAtom: ExternalAtom<ScreenInfo> = screenAtom
const size: WindowSize = app.get(windowSizeAtom)
const info: ScreenInfo = app.get(screenAtom)
const orientation: ScreenOrientationType = info.orientationType
const width: number = size.innerWidth + info.width
// @ts-expect-error packed declarations keep the sources read-only
app.set(windowSizeAtom, size)
// @ts-expect-error packed declarations keep the sources read-only
app.reset(screenAtom)
// @ts-expect-error packed declarations keep the sources read-only
app.update(screenAtom, () => info)
// @ts-expect-error packed snapshots are read-only
size.innerWidth = 1
// @ts-expect-error packed snapshots are read-only
info.devicePixelRatio = 2
${
    dom
        ? `const fromDom = (t: OrientationType): ScreenOrientationType => t
const toDom = (t: ScreenOrientationType): OrientationType => t
void [fromDom, toDom]
`
        : ""
}void [sizeAtom, infoAtom, orientation, width]
`

/**
 * Installs the packed geometry tarballs next to one core + React pair and runs
 * every consumer check against it. `core` and `react` are npm specs: the packed
 * workspace tarballs, or published versions from the registry.
 */
const checkConsumer = async (label: string, core: string, react: string) => {
    const dir = join(consumer, label.replace(/[^a-z0-9.-]+/gi, "-"))
    await mkdir(dir, { recursive: true })
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify(
            {
                name: "valdres-browser-geometry-packed-consumer",
                private: true,
                type: "module",
                dependencies: {
                    ...Object.fromEntries(
                        geometryNames.map(name => [
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
    await writeFile(join(dir, "browserless.mjs"), BROWSERLESS)
    await writeFile(join(dir, "dom.mjs"), DOM)
    const outputs = [
        run(
            `browserless consumer (${label})`,
            ["node", "browserless.mjs"],
            dir,
        ).stdout.trim(),
        run(`dom consumer (${label})`, ["node", "dom.mjs"], dir).stdout.trim(),
    ]
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
// The declared floor, against the artifacts actually published for it: the
// peer range is a claim about these versions, so it is executed, not inferred.
await checkConsumer(
    `published floor ${BROWSER_GEOMETRY_FLOOR.valdres}`,
    BROWSER_GEOMETRY_FLOOR.valdres,
    BROWSER_GEOMETRY_FLOOR["valdres-react"],
)
// Optional extra published pairs, e.g.
// BROWSER_GEOMETRY_EXTRA_CORES=1.0.0-beta.44:1.0.0-beta.8
for (const pair of (process.env.BROWSER_GEOMETRY_EXTRA_CORES ?? "")
    .split(",")
    .filter(Boolean)) {
    const [core, react] = pair.split(":")
    await checkConsumer(`published ${core}`, core!, react!)
}

for (const name of geometryNames) {
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
        `size ${name}: tarball ${statSync(packed.get(name)!.tarball).size} B, min+gzip ${gzipSync(new Uint8Array(await readFile(minified))).length} B (valdres external)`,
    )
}
console.log(`PACKED_OK against valdres@${coreVersion} on node ${nodeVersion}`)
await rm(workspace, { recursive: true, force: true })
