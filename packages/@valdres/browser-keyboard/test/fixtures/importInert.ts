/**
 * Fresh process with a DOM: counts every listener attached to `document` and
 * `window` from BEFORE the package is imported, so import-time and read-time
 * activation cannot hide behind an earlier test's hub.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { strict as assert } from "node:assert"

GlobalRegistrator.register()

const attached: string[] = []
for (const [name, target] of [
    ["document", document],
    ["window", window],
] as const) {
    const add = target.addEventListener.bind(target)
    target.addEventListener = ((type: string, ...rest: unknown[]) => {
        attached.push(`${name}:${type}`)
        return (add as (...args: unknown[]) => void)(type, ...rest)
    }) as typeof target.addEventListener
}

const { store } = await import("valdres")
const kb = await import("../../src/index")
assert.deepEqual(attached, [], "importing attached listeners")

const app = store()
app.get(kb.keyboardAtom)
app.get(kb.pressedKeysSelector)
app.get(kb.pressedCodesSelector)
app.get(kb.pressedKeyValuesSelector)
app.get(kb.modifierSelector("meta"))
app.get(kb.isCodePressedSelector("KeyA"))
app.get(kb.isKeyPressedSelector("a"))
app.get(kb.toggleKeySelector("CapsLock"))
app.get(kb.lastKeyDownAtom)
app.get(kb.lastKeyDownSelector("KeyA"))
assert.deepEqual(attached, [], "a dormant read attached listeners")

const stop = app.sub(kb.toggleKeySelector("CapsLock"), () => {})
assert.deepEqual(attached.sort(), [
    "document:keydown",
    "document:keyup",
    "document:visibilitychange",
    "window:blur",
])
stop()
app.dispose()

await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
