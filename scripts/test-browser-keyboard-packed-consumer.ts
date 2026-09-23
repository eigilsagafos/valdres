/**
 * Packed-consumer gate for `@valdres/browser-keyboard`.
 *
 * Reuses the mechanics of `test-browser-media-packed-consumer.ts` — shadow-stage
 * `dist`, the repository's real `scripts/prepack.ts`, `npm pack`, an isolated
 * `npm install` — without inserting keyboard into the media registry, whose
 * fixtures are media-query-shaped. Proves against the installed artifact, not
 * workspace source: browserless import and read-only rejection, the persistent
 * hub's listener accounting (explicit activation, two stores, unsubscribe keeps
 * tracking, blur reset), packed declarations, the peer floor through a real
 * semver implementation, and that no source manifest changed.
 *
 *   bun run scripts/test-browser-keyboard-packed-consumer.ts
 *   bun run test:browser-keyboard:packed
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { gzipSync } from "node:zlib"
import {
    BROWSER_KEYBOARD_CORE_PEER_RANGE,
    BROWSER_KEYBOARD_DIR,
    BROWSER_KEYBOARD_NAME,
} from "./lib/browser-keyboard-package"

const ROOT = join(import.meta.dir, "..")
const PEER = BROWSER_KEYBOARD_CORE_PEER_RANGE
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
    [BROWSER_KEYBOARD_NAME]: join(ROOT, BROWSER_KEYBOARD_DIR),
} as const
type Name = keyof typeof dirs

const workspace = await mkdtemp(
    join(tmpdir(), "valdres-browser-keyboard-packed-"),
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

run("build core", ["bun", "--filter", "valdres", "build"], ROOT)
run("build core types", ["bun", "--filter", "valdres", "build:types"], ROOT)
run("build keyboard", ["bun", "run", "build"], dirs[BROWSER_KEYBOARD_NAME])
run(
    "build keyboard types",
    ["bun", "run", "build:types"],
    dirs[BROWSER_KEYBOARD_NAME],
)

const before = new Map<Name, string>()
for (const name of Object.keys(dirs) as Name[])
    before.set(name, await readFile(join(dirs[name], "package.json"), "utf8"))

const packed = new Map<
    Name,
    { tarball: string; staged: string; manifest: any; files: string[] }
>()
for (const name of Object.keys(dirs) as Name[]) {
    const staged = join(stage, "packages", name)
    await mkdir(staged, { recursive: true })
    await cp(join(dirs[name], "dist"), join(staged, "dist"), {
        recursive: true,
    })
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
    assert.equal(prepacked.scripts, undefined)
    assert.equal(prepacked.devDependencies, undefined)
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
for (const name of Object.keys(dirs) as Name[])
    assert.equal(
        await readFile(join(dirs[name], "package.json"), "utf8"),
        before.get(name),
        `${name}/package.json changed`,
    )
console.log("manifests byte-identical after staging: ok")

const kb = packed.get(BROWSER_KEYBOARD_NAME)!
const coreVersion = packed.get("valdres")!.manifest.version
console.log("keyboard prepacked exports:", JSON.stringify(kb.manifest.exports))
console.log(
    "keyboard tarball files:",
    kb.files.length,
    kb.files.filter(f => !f.startsWith("dist/types/")).join(", "),
)
assert.ok(!kb.files.some(f => f.includes(".test.")), "tests shipped")
assert.ok(!kb.files.some(f => f.startsWith("src/")), "src shipped")
assert.equal(kb.manifest.peerDependencies?.valdres, PEER)
assert.ok(
    !JSON.stringify(kb.manifest).includes("workspace:"),
    "workspace: range shipped",
)
assert.equal(
    Bun.semver.satisfies(coreVersion, PEER),
    true,
    `packed core ${coreVersion} outside ${PEER}`,
)
assert.equal(Bun.semver.satisfies("1.0.0", PEER), true)
assert.equal(Bun.semver.satisfies("1.0.0-beta.39", PEER), false)
assert.equal(Bun.semver.satisfies("2.0.0", PEER), false)
console.log(
    `peer ${PEER} admits packed core ${coreVersion}, rejects beta.39 and 2.0.0: ok`,
)

await writeFile(
    join(consumer, "package.json"),
    JSON.stringify(
        {
            name: "valdres-browser-keyboard-packed-consumer",
            private: true,
            type: "module",
            dependencies: Object.fromEntries(
                [...packed].map(([name, p]) => [name, `file:${p.tarball}`]),
            ),
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
import { createRequire } from "node:module"
import { store } from "valdres"
import * as kb from "@valdres/browser-keyboard"
import * as again from "@valdres/browser-keyboard"
assert.equal(typeof globalThis.document, "undefined")
assert.match(import.meta.resolve("@valdres/browser-keyboard"), /node_modules\\/@valdres\\/browser-keyboard\\/dist\\//)
assert.equal(again.keyboardAtom, kb.keyboardAtom)
const app = store()
const empty = app.get(kb.keyboardAtom)
assert.deepEqual(empty, { pressed: [], locks: { CapsLock: null, NumLock: null, ScrollLock: null } })
assert.ok(Object.isFrozen(empty))
assert.deepEqual(app.get(kb.pressedCodesSelector), [])
assert.equal(app.get(kb.toggleKeySelector("CapsLock")), null)
kb.activateKeyboard()
assert.equal(app.get(kb.keyboardAtom), empty)
const stop = app.sub(kb.keyboardAtom, () => { throw new Error("must not notify") })
stop()
for (const call of [() => app.set(kb.keyboardAtom, empty), () => app.reset(kb.keyboardAtom), () => app.update(kb.keyboardAtom, v => v), () => app.set(kb.pressedKeysSelector, [])])
    assert.throws(call, TypeError)
app.dispose()
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
const attached = new Map()
const track = (name, target) => {
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target)
    target.addEventListener = (type, l) => { attached.set(name + ":" + type, (attached.get(name + ":" + type) ?? 0) + 1); add(type, l) }
    target.removeEventListener = (type, l) => { attached.set(name + ":" + type, attached.get(name + ":" + type) - 1); remove(type, l) }
}
const win = new EventTarget()
const doc = new EventTarget()
doc.defaultView = win
doc.visibilityState = "visible"
track("document", doc); track("window", win)
globalThis.document = doc
const key = (type, code, keyName, extra = {}) => {
    const event = new Event(type)
    Object.defineProperties(event, {
        code: { value: code }, key: { value: keyName }, isComposing: { value: false }, keyCode: { value: 0 },
        repeat: { value: !!extra.repeat }, getModifierState: { value: lock => lock === "CapsLock" && !!extra.caps },
    })
    doc.dispatchEvent(event)
}
const total = () => [...attached.values()].reduce((a, b) => a + b, 0)

const { store } = await import("valdres")
const kb = await import("@valdres/browser-keyboard")
const first = store(), second = store()
assert.equal(first.get(kb.keyboardAtom).pressed.length, 0)
assert.equal(total(), 0, "import/dormant read attached")
kb.activateKeyboard(); kb.activateKeyboard()
assert.equal(total(), 4, "explicit activation attaches one hub")
key("keydown", "ShiftLeft", "Shift", { caps: true })
assert.deepEqual(first.get(kb.pressedCodesSelector), ["ShiftLeft"], "dormant read after activation")
key("keyup", "ShiftLeft", "Shift")

const seen = []
const stopFirst = first.sub(kb.pressedCodesSelector, () => seen.push("first:" + first.get(kb.pressedCodesSelector)))
const stopSecond = second.sub(kb.pressedCodesSelector, () => seen.push("second:" + second.get(kb.pressedCodesSelector)))
assert.equal(total(), 4)
key("keydown", "KeyA", "a", { caps: true })
assert.deepEqual(seen, ["first:KeyA", "second:KeyA"])
assert.equal(first.get(kb.toggleKeySelector("CapsLock")), true)
key("keydown", "KeyA", "a", { repeat: true })
assert.equal(seen.length, 2, "repeat notified")

stopFirst(); stopSecond()
assert.equal(total(), 4, "unsubscribe detached the hub")
key("keydown", "KeyB", "b")
key("keyup", "KeyA", "a")
assert.equal(seen.length, 2)
assert.deepEqual(first.get(kb.pressedCodesSelector), ["KeyB"])

const late = []
const stopLate = second.sub(kb.pressedCodesSelector, () => late.push(second.get(kb.pressedCodesSelector).join()))
win.dispatchEvent(new Event("blur"))
assert.deepEqual(late, [""])
assert.equal(second.get(kb.toggleKeySelector("CapsLock")), null)
stopLate()
first.dispose(); second.dispose()
assert.equal(total(), 4)
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
                strict: true,
                noEmit: true,
                skipLibCheck: false,
            },
            include: ["types.ts"],
        },
        null,
        2,
    ),
)
await writeFile(
    join(consumer, "types.ts"),
    `import { store, type ExternalAtom } from "valdres"
import { activateKeyboard, keyboardAtom, pressedKeysSelector, pressedCodesSelector, toggleKeySelector, modifierSelector, isCodePressedSelector, type KeyboardSnapshot, type PressedKey, type KeyboardCode } from "@valdres/browser-keyboard"
const app = store()
const source: ExternalAtom<KeyboardSnapshot> = keyboardAtom
const pressed: readonly PressedKey[] = app.get(pressedKeysSelector)
const codes: readonly string[] = app.get(pressedCodesSelector)
const caps: boolean | null = app.get(toggleKeySelector("CapsLock"))
const shift: boolean = app.get(modifierSelector("shift"))
const code: KeyboardCode = "KeyA"
const held: boolean = app.get(isCodePressedSelector(code))
// @ts-expect-error packed declarations keep the source read-only
app.set(keyboardAtom, app.get(keyboardAtom))
// @ts-expect-error packed declarations keep derived reads read-only
app.set(toggleKeySelector("CapsLock"), true)
const started: void = activateKeyboard()
void [source, pressed, codes, caps, shift, held, started]
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

const dist = join(kb.staged, "dist", "index.js")
const minified = join(workspace, "kb.min.js")
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
    `size: tarball ${statSync(kb.tarball).size} B, dist/index.js ${statSync(dist).size} B, min+gzip ${gzipSync(await readFile(minified)).length} B (valdres external)`,
)
console.log(`PACKED_OK against valdres@${coreVersion}`)
await rm(workspace, { recursive: true, force: true })
