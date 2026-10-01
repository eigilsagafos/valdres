/**
 * Packed-consumer gate for `@valdres/hotkeys` and `@valdres-react/hotkeys`.
 *
 * Same mechanics as the keyboard gate — shadow-stage `dist`, the repository's
 * real `scripts/prepack.ts`, `npm pack`, an isolated `npm install` — for the
 * five packages a hotkeys consumer installs. Proves against the artifacts, not
 * workspace source: browserless import and binding, that the public entry and
 * `adapter-internals` share ONE dispatcher registry in the split build,
 * dispatch with cancellation and the pre-cancelled filter, server rendering of
 * the React hooks, packed declarations, peer ranges, and that no source
 * manifest changed.
 *
 * Both hotkeys packages are release-ignored; this gate checks the artifacts
 * they would ship. A dependency whose next version is still pending (a
 * changeset not yet versioned) is staged at the version Changesets reports for
 * it, so the peer ranges are checked against what will actually be released.
 *
 *   bun run scripts/test-hotkeys-packed-consumer.ts
 *   bun run test:hotkeys:packed
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

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
const dirs = {
    valdres: join(ROOT, "packages", "valdres"),
    "valdres-react": join(ROOT, "packages", "valdres-react"),
    "@valdres/browser-keyboard": join(
        ROOT,
        "packages/@valdres/browser-keyboard",
    ),
    "@valdres/hotkeys": join(ROOT, "packages/@valdres/hotkeys"),
    "@valdres-react/hotkeys": join(ROOT, "packages/@valdres-react/hotkeys"),
} as const
type Name = keyof typeof dirs

const workspace = await mkdtemp(join(tmpdir(), "valdres-hotkeys-packed-"))
const stage = join(workspace, "stage")
const artifacts = join(workspace, "artifacts")
const consumer = join(workspace, "consumer")
await mkdir(join(stage, "scripts"), { recursive: true })
await mkdir(artifacts, { recursive: true })
await mkdir(consumer, { recursive: true })
for (const file of ["prepack.ts", "publish-metadata.ts"])
    await cp(join(ROOT, "scripts", file), join(stage, "scripts", file))
console.log(`workspace: ${workspace}`)

for (const name of Object.keys(dirs) as Name[]) {
    run(`build ${name}`, ["bun", "run", "build"], dirs[name])
    run(`build ${name} types`, ["bun", "run", "build:types"], dirs[name])
}

// Versions that pending changesets will produce, per Changesets itself. Its
// release plan needs no git, but `status` also compares against a branch:
// `--since` the repository's first commit counts every pending changeset and
// works without a local `main` (CI checks out full history for this job).
const firstCommit = run(
    "find the first commit",
    ["git", "rev-list", "--max-parents=0", "HEAD"],
    ROOT,
)
    .stdout.trim()
    .split("\n")
    .at(-1)!
const statusFile = join(workspace, "changeset-status.json")
run(
    "changeset status",
    [
        "bunx",
        "changeset",
        "status",
        `--since=${firstCommit}`,
        `--output=${statusFile}`,
    ],
    ROOT,
)
const pending = new Map<string, string>(
    (
        JSON.parse(await readFile(statusFile, "utf8")).releases as {
            name: string
            newVersion: string
        }[]
    ).map(release => [release.name, release.newVersion]),
)

const before = new Map<Name, string>()
for (const name of Object.keys(dirs) as Name[])
    before.set(name, await readFile(join(dirs[name], "package.json"), "utf8"))

const packed = new Map<
    Name,
    { tarball: string; manifest: any; files: string[] }
>()
for (const name of Object.keys(dirs) as Name[]) {
    const staged = join(stage, "packages", name)
    await mkdir(staged, { recursive: true })
    await cp(join(dirs[name], "dist"), join(staged, "dist"), {
        recursive: true,
    })
    const manifest = JSON.parse(before.get(name)!)
    delete manifest.gitHead
    if (pending.has(name)) {
        console.log(
            `${name}: staged at pending ${pending.get(name)} (workspace ${manifest.version})`,
        )
        manifest.version = pending.get(name)
    }
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
        manifest: prepacked,
        files: entry.files.map((f: any) => f.path),
    })
}
for (const name of Object.keys(dirs) as Name[])
    assert.equal(
        await readFile(join(dirs[name], "package.json"), "utf8"),
        before.get(name),
        `${name}/package.json changed`,
    )
console.log("manifests byte-identical after staging: ok")

// RELEASE-ENABLEMENT PREREQUISITE (both hotkeys packages are release-ignored):
// `@valdres-react/hotkeys` peers on `@valdres/hotkeys@^1.0.0-beta.7`, which also
// admits the already-published beta.7 with the retired API. Ignored packages are
// not versioned, so this check passes trivially today. When the hotkeys packages
// are made release-eligible, raise that floor to the first release carrying the
// v1 API in the same change.
for (const name of ["@valdres/hotkeys", "@valdres-react/hotkeys"] as const) {
    const { manifest, files } = packed.get(name)!
    assert.ok(!files.some(f => f.includes(".test.")), `${name}: tests shipped`)
    assert.ok(!files.some(f => f.startsWith("src/")), `${name}: src shipped`)
    assert.ok(
        !files.some(f => f.endsWith(".mdx")),
        `${name}: docs source shipped`,
    )
    assert.ok(
        !JSON.stringify(manifest).includes("workspace:"),
        `${name}: workspace: range shipped`,
    )
    for (const [peer, range] of Object.entries(
        manifest.peerDependencies ?? {},
    ) as [string, string][]) {
        const provided = packed.get(peer as Name)?.manifest.version
        if (provided === undefined) continue // react
        assert.equal(
            Bun.semver.satisfies(provided, range),
            true,
            `${name}: peer ${peer}@${range} rejects the packed ${provided}`,
        )
        console.log(`${name}: peer ${peer}@${range} admits ${provided}`)
    }
}
const hotkeysFiles = packed.get("@valdres/hotkeys")!.files
assert.ok(hotkeysFiles.includes("dist/adapter-internals.js"))
assert.ok(
    hotkeysFiles.some(f => /^dist\/chunk-.*\.js$/.test(f)),
    "split build has no shared chunk",
)
console.log(
    "hotkeys tarball:",
    hotkeysFiles.filter(f => !f.startsWith("dist/types/")).join(", "),
)

await writeFile(
    join(consumer, "package.json"),
    JSON.stringify(
        {
            name: "valdres-hotkeys-packed-consumer",
            private: true,
            type: "module",
            dependencies: {
                ...Object.fromEntries(
                    [...packed].map(([name, p]) => [name, `file:${p.tarball}`]),
                ),
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
    "install consumer",
    ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"],
    consumer,
)

await writeFile(
    join(consumer, "browserless.mjs"),
    `import { strict as assert } from "node:assert"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { atom, store } from "valdres"
import { Provider } from "valdres-react"
import * as hotkeys from "@valdres/hotkeys"
import * as internals from "@valdres/hotkeys/adapter-internals"
import { useHotkey, useHotkeyScope } from "@valdres-react/hotkeys"
assert.equal(typeof globalThis.document, "undefined")
assert.match(import.meta.resolve("@valdres/hotkeys"), /node_modules\\/@valdres\\/hotkeys\\/dist\\//)
const app = store()
const ran = atom(0)
const stop = hotkeys.bindHotkey(app, ["Mod+s", "Ctrl+KeyS"], tx => tx.set(ran, 1))
const release = hotkeys.activateHotkeyScope(app, hotkeys.hotkeyScope({ priority: 1 }))
assert.equal(app.get(hotkeys.shortcutSelector("Mod+s")), null)
assert.throws(() => hotkeys.bindHotkey(app, "Shift+?", () => {}), SyntaxError)
const handle = internals.registerBinding(app, internals.parseShortcuts("x"), () => ({ command: () => {} }))
handle.dispose()
release()
stop()
const modal = hotkeys.hotkeyScope()
const Page = () => {
    useHotkeyScope(modal)
    useHotkey("Escape", tx => tx.set(ran, 2), { scope: modal })
    return createElement("p", null, "page")
}
const explicit = store()
const Bare = () => (useHotkey("k", tx => tx.set(ran, 3), { store: explicit }), createElement("p", null, "bare"))
assert.equal(renderToString(createElement(Provider, { store: app }, createElement(Page))), "<p>page</p>")
assert.equal(renderToString(createElement(Bare)), "<p>bare</p>")
assert.equal(app.get(ran) + explicit.get(ran), 0)
app.dispose()
explicit.dispose()
console.log("BROWSERLESS_OK")
`,
)
console.log(
    run(
        "browserless consumer",
        ["node", "browserless.mjs"],
        consumer,
    ).stdout.trim(),
)

await writeFile(
    join(consumer, "dom.mjs"),
    `import { strict as assert } from "node:assert"
const win = new EventTarget()
const doc = new EventTarget()
doc.defaultView = win
doc.visibilityState = "visible"
globalThis.document = doc
const errors = []
const key = (type, code, keyName, { cancelled = false } = {}) => {
    const event = new Event(type, { cancelable: true })
    Object.defineProperties(event, {
        code: { value: code }, key: { value: keyName }, isComposing: { value: false }, keyCode: { value: 0 },
        repeat: { value: false }, getModifierState: { value: () => false },
    })
    if (cancelled) event.preventDefault()
    try { doc.dispatchEvent(event) } catch (error) { errors.push(error) }
    return event
}
// Node reports listener errors through process 'uncaughtException'-free
// EventTarget semantics: capture them instead of crashing.
process.on("uncaughtException", error => errors.push(error))

const { atom, store } = await import("valdres")
const { activateKeyboard } = await import("@valdres/browser-keyboard")
const hotkeys = await import("@valdres/hotkeys")
const internals = await import("@valdres/hotkeys/adapter-internals")
activateKeyboard()
const app = store()
const log = atom([])
const push = entry => tx => tx.set(log, [...tx.get(log), entry])
const stopSave = hotkeys.bindHotkey(app, "Ctrl+s", push("save"), { preventDefault: true })
key("keydown", "ControlLeft", "Control")
const save = key("keydown", "KeyS", "s")
key("keyup", "KeyS", "s")
key("keyup", "ControlLeft", "Control")
assert.equal(save.defaultPrevented, true)
assert.deepEqual(app.get(log), ["save"])

// Pre-cancelled keydowns: skipped by default, filtered before arbitration.
hotkeys.bindHotkey(app, "q", push("q:default"), { priority: 1 })
hotkeys.bindHotkey(app, "q", push("q:opt-in"), { handleDefaultPrevented: true })
key("keydown", "KeyQ", "q", { cancelled: true })
key("keyup", "KeyQ", "q")
key("keydown", "KeyQ", "q")
key("keyup", "KeyQ", "q")
assert.deepEqual(app.get(log), ["save", "q:opt-in", "q:default"])

// One registry across both entries: an adapter binding and a public binding of
// equal rank in one store conflict instead of both running.
hotkeys.bindHotkey(app, "k", push("public"))
const adapter = internals.registerBinding(app, internals.parseShortcuts("k"), () => ({ command: push("adapter") }))
await new Promise(resolve => setTimeout(resolve, 0))
const before = errors.length
key("keydown", "KeyK", "k")
await new Promise(resolve => setTimeout(resolve, 0))
assert.deepEqual(app.get(log), ["save", "q:opt-in", "q:default"], "both ran: two registries")
assert.ok(errors.slice(before).some(error => String(error.causes?.[0] ?? error).includes("HotkeyConflictError")), "no conflict reported")
adapter.dispose()
stopSave()
app.dispose()
console.log("DOM_OK")
`,
)
console.log(run("dom consumer", ["node", "dom.mjs"], consumer).stdout.trim())

await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify(
        {
            compilerOptions: {
                target: "ESNext",
                module: "ESNext",
                moduleResolution: "bundler",
                lib: ["ESNext", "DOM"],
                jsx: "react-jsx",
                strict: true,
                noEmit: true,
                skipLibCheck: false,
            },
            include: ["types.tsx"],
        },
        null,
        2,
    ),
)
await writeFile(
    join(consumer, "types.tsx"),
    `import { atom, store, type Selector, type Transaction } from "valdres"
import type { KeyDown } from "@valdres/browser-keyboard"
import {
    activateHotkeyScope, bindHotkey, hotkeyScope, shortcutSelector, HotkeyConflictError,
    type HotkeyCommand, type HotkeyHit, type HotkeyOptions, type HotkeyScope,
} from "@valdres/hotkeys"
import { useHotkey, useHotkeyScope, type UseHotkeyOptions } from "@valdres-react/hotkeys"
const app = store()
const enabled = atom(true)
const scope: HotkeyScope = hotkeyScope({ name: "dialog", priority: 10, exclusive: true })
const options: HotkeyOptions = { enabled, scope, priority: 1, repeat: true, editable: true, preventDefault: true, handleDefaultPrevented: true }
const command: HotkeyCommand = (tx: Transaction, hit: HotkeyHit) => tx.set(enabled, hit.keyDown.repeat)
const stop: () => void = bindHotkey(app, ["Mod+s", "Ctrl+KeyS"], command, options)
const release: () => void = activateHotkeyScope(app, scope)
const match: Selector<KeyDown | null> = shortcutSelector("Mod+s")
const conflict: readonly string[] = new HotkeyConflictError(null as unknown as KeyDown, ["a"]).shortcuts
// @ts-expect-error enabled is a boolean or a State<boolean>, not a callback
bindHotkey(app, "k", command, { enabled: () => true })
// @ts-expect-error retired option
bindHotkey(app, "k", command, { keyup: true })
function Component() {
    const reactOptions: UseHotkeyOptions = { ...options, store: app }
    useHotkey("Escape", command, reactOptions)
    useHotkeyScope(scope, { store: app, active: true })
    return null
}
void [stop, release, match, conflict, Component]
`,
)
run(
    "typescript consumer",
    [
        join(ROOT, "node_modules", ".bin", "tsgo"),
        "--noEmit",
        "-p",
        "tsconfig.json",
    ],
    consumer,
)
console.log("TYPES_OK")
console.log("PACKED_OK")
await rm(workspace, { recursive: true, force: true })
