/**
 * Fresh process with a DOM: counts every listener attached to `document` and
 * `window` from BEFORE the package is imported, so import-time or read-time
 * attachment cannot hide behind an earlier test.
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
const { isVisibleSelector, visibilityAtom } = await import("../../src/index")
assert.deepEqual(attached, [], "importing attached listeners")

const app = store()
assert.equal(app.get(visibilityAtom), document.visibilityState)
assert.equal(app.get(isVisibleSelector), document.visibilityState === "visible")
assert.deepEqual(attached, [], "a dormant read attached listeners")

const stop = app.sub(isVisibleSelector, () => {})
assert.deepEqual(attached.sort(), ["document:visibilitychange"])
stop()
app.dispose()

await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
