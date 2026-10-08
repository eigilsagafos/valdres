/**
 * Packed-consumer gate for the browser-status packages: `@valdres/browser-online`,
 * `-focus`, `-visibility` and `-presence`.
 *
 * Same mechanics as the keyboard and hotkeys gates — shadow-stage `dist`, the
 * repository's real `scripts/prepack.ts`, `npm pack`, an isolated `npm install`
 * — so it proves the *installed artifacts*, not workspace source:
 *
 * - browserless import, dormant reads, no-op subscriptions and read-only
 *   rejection in plain Node, plus React server rendering of the seeds through
 *   the packed `valdres-react`;
 * - listener accounting against a DOM-shaped host: per-store-tree listeners for
 *   online and visibility, ONE shared focus/blur pair per document for focus,
 *   and presence adding nothing of its own;
 * - presence resolving the very same focus and visibility copies the app
 *   imports (one definition identity, no nested install);
 * - packed declarations, with and without the DOM library;
 * - all of the above against BOTH the packed workspace core + React and the
 *   published pair at the declared peer floor (`BROWSER_STATUS_FLOOR`), so the
 *   floor is executed rather than inferred from source;
 * - peer floors through a real semver implementation, and that no source
 *   manifest changed.
 *
 *   bun run scripts/test-browser-status-packed-consumer.ts
 *   bun run test:browser-status:packed
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { gzipSync } from "node:zlib"
import {
    BROWSER_STATUS_CORE_PEER_RANGE as PEER,
    BROWSER_STATUS_FLOOR,
    BROWSER_STATUS_PACKAGES,
} from "./lib/browser-status-packages"

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
        BROWSER_STATUS_PACKAGES.map(pkg => [pkg.name, join(ROOT, pkg.dir)]),
    ),
}
const statusNames = BROWSER_STATUS_PACKAGES.map(pkg => pkg.name)

const workspace = await mkdtemp(join(tmpdir(), "valdres-browser-status-packed-"))
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
for (const name of statusNames) {
    const { manifest, files } = packed.get(name)!
    assert.ok(!files.some(f => f.includes(".test.")), `${name} shipped tests`)
    assert.ok(!files.some(f => f.startsWith("src/") || f.startsWith("test/")), `${name} shipped sources`)
    assert.ok(!JSON.stringify(manifest).includes("workspace:"), `${name} shipped a workspace: range`)
    assert.equal(manifest.peerDependencies?.valdres, PEER, `${name} peer floor`)
    console.log(`${name}: ${files.length} files, exports ${JSON.stringify(manifest.exports)}`)
}
assert.equal(Bun.semver.satisfies(coreVersion, PEER), true, `packed core ${coreVersion} outside ${PEER}`)
assert.equal(Bun.semver.satisfies("1.0.0-beta.38", PEER), false)
assert.equal(Bun.semver.satisfies("2.0.0", PEER), false)
console.log(`peer ${PEER} admits packed core ${coreVersion}, rejects beta.38 and 2.0.0: ok`)

// Presence depends on focus and visibility by plain semver. Report what that
// range admits: the published 1.0.0-beta.8 copies predate the migration, so
// release enablement has to raise the floor (see the lane's release plan).
const presenceDeps = packed.get("@valdres/browser-presence")!.manifest.dependencies
assert.deepEqual(Object.keys(presenceDeps).sort(), ["@valdres/browser-focus", "@valdres/browser-visibility"])
for (const [dep, range] of Object.entries(presenceDeps as Record<string, string>)) {
    assert.equal(Bun.semver.satisfies(packed.get(dep)!.manifest.version, range), true, `${dep}@${range}`)
    if (Bun.semver.satisfies("1.0.0-beta.8", range))
        console.log(`NOTE presence -> ${dep}@${range} still admits the legacy, pre-migration 1.0.0-beta.8`)
}

const BROWSERLESS = `import { strict as assert } from "node:assert"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { onlineAtom } from "@valdres/browser-online"
import { focusAtom } from "@valdres/browser-focus"
import { visibilityAtom, isVisibleSelector } from "@valdres/browser-visibility"
import { presenceSelector } from "@valdres/browser-presence"
assert.equal(typeof globalThis.document, "undefined")
assert.equal(typeof globalThis.window, "undefined")
for (const name of ["online", "focus", "visibility", "presence"])
    assert.match(import.meta.resolve("@valdres/browser-" + name), new RegExp("node_modules/@valdres/browser-" + name + "/dist/"))
const app = store()
assert.deepEqual(
    [app.get(onlineAtom), app.get(focusAtom), app.get(visibilityAtom), app.get(isVisibleSelector), app.get(presenceSelector)],
    [true, true, "visible", true, true],
)
for (const state of [onlineAtom, focusAtom, visibilityAtom, presenceSelector]) {
    const stop = app.sub(state, () => { throw new Error("a DOM-less source must never notify") })
    stop()
}
for (const call of [
    () => app.set(onlineAtom, false), () => app.reset(focusAtom), () => app.update(visibilityAtom, v => v),
    () => app.set(isVisibleSelector, false), () => app.set(presenceSelector, false),
]) assert.throws(call, TypeError)
const View = () => createElement("p", null, [
    String(useValue(onlineAtom)), String(useValue(focusAtom)), useValue(visibilityAtom), String(useValue(presenceSelector)),
].join("|"))
const render = () => { const request = store(); try { return renderToString(createElement(Provider, { store: request }, createElement(View))) } finally { request.dispose() } }
assert.equal(render(), "<p>true|true|visible|true</p>")
assert.equal(render(), render())
app.dispose()
console.log("BROWSERLESS_OK")
`
const DOM = `import { strict as assert } from "node:assert"
// A DOM-shaped host on plain EventTargets, counting distinct listeners.
const counts = new Map()
const track = (name, target) => {
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target)
    const sets = new Map()
    target.addEventListener = (type, l) => {
        const set = sets.get(type) ?? new Set(); sets.set(type, set); set.add(l)
        counts.set(name + ":" + type, set.size); add(type, l)
    }
    target.removeEventListener = (type, l) => {
        const set = sets.get(type); set?.delete(l)
        counts.set(name + ":" + type, set?.size ?? 0); remove(type, l)
    }
}
const attached = () => Object.fromEntries([...counts].filter(([, n]) => n > 0))
const host = { online: true, focused: true, visibility: "visible", active: null }
const win = new EventTarget()
const doc = new EventTarget()
doc.defaultView = win
doc.hasFocus = () => host.focused
Object.defineProperty(doc, "visibilityState", { get: () => host.visibility })
Object.defineProperty(doc, "activeElement", { get: () => host.active })
Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, get: () => host.online })
track("window", win); track("document", doc)
globalThis.window = win
globalThis.document = doc
const fire = (target, type) => target.dispatchEvent(new Event(type))

const { store } = await import("valdres")
const { onlineAtom } = await import("@valdres/browser-online")
const { focusAtom } = await import("@valdres/browser-focus")
const { visibilityAtom, isVisibleSelector } = await import("@valdres/browser-visibility")
const { presenceSelector } = await import("@valdres/browser-presence")
assert.deepEqual(attached(), {}, "import attached listeners")

const first = store(), second = store(), dormant = store()
host.online = false; host.focused = false; host.visibility = "hidden"
assert.deepEqual([first.get(onlineAtom), first.get(focusAtom), first.get(visibilityAtom), first.get(presenceSelector)], [false, false, "hidden", false])
assert.deepEqual(attached(), {}, "dormant reads attached listeners")
host.online = true; host.focused = true; host.visibility = "visible"

// online + visibility: one set of listeners per store tree.
const seen = []
const stops = [
    first.sub(onlineAtom, () => seen.push("first:" + first.get(onlineAtom))),
    second.sub(onlineAtom, () => seen.push("second:" + second.get(onlineAtom))),
    first.sub(isVisibleSelector, () => {}),
    second.sub(visibilityAtom, () => {}),
]
assert.deepEqual(attached(), { "window:online": 2, "window:offline": 2, "document:visibilitychange": 2 })
host.online = false; fire(win, "offline")
assert.deepEqual(seen.sort(), ["first:false", "second:false"])
for (const stop of stops.splice(0)) stop()
assert.deepEqual(attached(), {})

// focus: one shared pair per document, event-derived while attached.
const focusSeen = []
stops.push(first.sub(focusAtom, () => focusSeen.push("first:" + first.get(focusAtom))))
stops.push(second.sub(focusAtom, () => focusSeen.push("second:" + second.get(focusAtom))))
assert.deepEqual(attached(), { "window:focus": 1, "window:blur": 1 })
fire(win, "blur") // hasFocus() still true, as with focus inside a nested frame
assert.deepEqual(focusSeen, ["first:false", "second:false"])
assert.equal(dormant.get(focusAtom), false, "a dormant read disagrees with the attached hub")
for (const stop of stops.splice(0)) stop()
assert.deepEqual(attached(), {})
assert.equal(dormant.get(focusAtom), true, "a dormant read without a hub must sample the window")
host.active = { tagName: "IFRAME", contentWindow: {} } // focus delegated to a nested frame
assert.equal(dormant.get(focusAtom), false, "a frame holding focus must read as this window blurred")
host.active = null

// presence: the two packages' attachments, nothing of its own.
const presence = []
stops.push(first.sub(presenceSelector, () => presence.push(first.get(presenceSelector))))
assert.deepEqual(attached(), { "window:focus": 1, "window:blur": 1, "document:visibilitychange": 1 })
stops.push(first.sub(focusAtom, () => {}))
assert.deepEqual(attached(), { "window:focus": 1, "window:blur": 1, "document:visibilitychange": 1 }, "presence and the app read different focus definitions")
fire(win, "blur"); fire(win, "focus")
host.visibility = "hidden"; fire(doc, "visibilitychange")
assert.deepEqual(presence, [false, true, false])

// Disposal releases everything that store retained.
first.dispose()
assert.deepEqual(attached(), {})
second.dispose(); dormant.dispose()
console.log("DOM_OK")
`
const typesSource = (dom: boolean) => `import { store, type ExternalAtom, type Selector } from "valdres"
import { onlineAtom } from "@valdres/browser-online"
import { focusAtom } from "@valdres/browser-focus"
import { visibilityAtom, isVisibleSelector, type PageVisibility } from "@valdres/browser-visibility"
import { presenceSelector } from "@valdres/browser-presence"
const app = store()
const online: ExternalAtom<boolean> = onlineAtom
const focus: ExternalAtom<boolean> = focusAtom
const visibility: ExternalAtom<PageVisibility> = visibilityAtom
const state: "visible" | "hidden" = app.get(visibilityAtom)
const visible: Selector<boolean> = isVisibleSelector
const present: boolean = app.get(presenceSelector)
// @ts-expect-error packed declarations keep the sources read-only
app.set(onlineAtom, false)
// @ts-expect-error packed declarations keep the sources read-only
app.reset(focusAtom)
// @ts-expect-error packed declarations keep the sources read-only
app.update(visibilityAtom, () => "hidden" as const)
// @ts-expect-error packed declarations keep derived reads read-only
app.set(presenceSelector, true)
${dom ? `const fromDom = (s: DocumentVisibilityState): PageVisibility => s
const toDom = (s: PageVisibility): DocumentVisibilityState => s
void [fromDom, toDom]
` : ""}void [online, focus, visibility, state, visible, present]
`

/**
 * Installs the packed browser-status tarballs next to one core + React pair
 * and runs every consumer check against it. `core` and `react` are npm specs:
 * the packed workspace tarballs, or published versions from the registry.
 */
const checkConsumer = async (label: string, core: string, react: string) => {
    const dir = join(consumer, label.replace(/[^a-z0-9.-]+/gi, "-"))
    await mkdir(dir, { recursive: true })
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify(
            {
                name: "valdres-browser-status-packed-consumer",
                private: true,
                type: "module",
                dependencies: {
                    ...Object.fromEntries(
                        statusNames.map(name => [name, `file:${packed.get(name)!.tarball}`]),
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
    // One copy of each composed package: presence must share the app's definitions.
    for (const dep of ["@valdres/browser-focus", "@valdres/browser-visibility", "valdres"])
        assert.equal(
            existsSync(join(dir, "node_modules/@valdres/browser-presence/node_modules", dep)),
            false,
            `${label}: presence installed a nested ${dep}`,
        )
    await writeFile(join(dir, "browserless.mjs"), BROWSERLESS)
    await writeFile(join(dir, "dom.mjs"), DOM)
    const outputs = [
        run(`browserless consumer (${label})`, ["node", "browserless.mjs"], dir).stdout.trim(),
        run(`dom consumer (${label})`, ["node", "dom.mjs"], dir).stdout.trim(),
    ]
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
// The declared floor, against the artifacts actually published for it: the
// peer range is a claim about these versions, so it is executed, not inferred.
await checkConsumer(
    `published floor ${BROWSER_STATUS_FLOOR.valdres}`,
    BROWSER_STATUS_FLOOR.valdres,
    BROWSER_STATUS_FLOOR["valdres-react"],
)
// Optional extra published pairs, e.g.
// BROWSER_STATUS_EXTRA_CORES=1.0.0-beta.40:1.0.0-beta.7,1.0.0-beta.41:1.0.0-beta.8
for (const pair of (process.env.BROWSER_STATUS_EXTRA_CORES ?? "").split(",").filter(Boolean)) {
    const [core, react] = pair.split(":")
    await checkConsumer(`published ${core}`, core!, react!)
}

for (const name of statusNames) {
    const dist = join(packed.get(name)!.staged, "dist", "index.js")
    const minified = join(workspace, `${basename(name)}.min.js`)
    run("minify", ["bun", "build", dist, "--minify", "--packages", "external", "--outfile", minified], workspace)
    console.log(
        `size ${name}: tarball ${statSync(packed.get(name)!.tarball).size} B, min+gzip ${gzipSync(await readFile(minified)).length} B (valdres external)`,
    )
}
console.log(`PACKED_OK against valdres@${coreVersion}`)
await rm(workspace, { recursive: true, force: true })
