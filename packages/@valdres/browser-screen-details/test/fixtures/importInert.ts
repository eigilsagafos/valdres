/**
 * Fresh process with a DOM: records every getScreenDetails call and
 * Permissions API query from BEFORE the package is imported, so import-time or
 * read-time work cannot hide behind an earlier test.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { strict as assert } from "node:assert"

GlobalRegistrator.register()

const calls: string[] = []
const getScreenDetails = () => {
    calls.push("getScreenDetails")
    return new Promise(() => {})
}
Object.defineProperty(window, "getScreenDetails", { configurable: true, value: getScreenDetails })
Object.defineProperty(globalThis, "getScreenDetails", { configurable: true, value: getScreenDetails })
Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: {
        query: (descriptor: { name: string }) => {
            calls.push(`query:${descriptor.name}`)
            return new Promise(() => {})
        },
    },
})

const { store } = await import("valdres")
const { screenDetailsAtom, screenPermissionAtom, screensAtom, requestScreenDetails } =
    await import("../../src/index")
assert.deepEqual(calls, [], "importing did work")

const app = store()
assert.equal(app.get(screenDetailsAtom).status, "idle")
assert.equal(app.get(screenPermissionAtom), "prompt")
assert.deepEqual(calls, [], "a dormant read did work")

const stop = app.sub(screensAtom, () => {})
assert.deepEqual(calls, [], "subscribing to screens must never prompt")
const stopPermission = app.sub(screenPermissionAtom, () => {})
assert.deepEqual(calls, ["query:window-management"])
void requestScreenDetails()
assert.deepEqual(calls, ["query:window-management", "getScreenDetails"])
stop()
stopPermission()
app.dispose()

await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
