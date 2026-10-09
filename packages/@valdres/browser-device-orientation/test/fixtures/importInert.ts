/**
 * Fresh process with a DOM: records every listener attached to `window` and
 * every Permissions API query from BEFORE the package is imported, so
 * import-time or read-time work cannot hide behind an earlier test.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { strict as assert } from "node:assert"

GlobalRegistrator.register()

const attached: string[] = []
const add = window.addEventListener.bind(window)
window.addEventListener = ((type: string, ...rest: unknown[]) => {
    attached.push(type)
    return (add as (...args: unknown[]) => void)(type, ...rest)
}) as typeof window.addEventListener
const queried: string[] = []
const requested: string[] = []
Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: {
        query: (descriptor: { name: string }) => {
            queried.push(descriptor.name)
            return new Promise(() => {})
        },
    },
})
Object.defineProperty(window.DeviceOrientationEvent, "requestPermission", {
    configurable: true,
    value: () => {
        requested.push("motion")
        return new Promise(() => {})
    },
})

const { store } = await import("valdres")
const { orientationAtom, orientationStatusAtom, permissionAtom } = await import(
    "../../src/index"
)
assert.deepEqual([attached, queried, requested], [[], [], []], "importing did work")

const app = store()
assert.equal(app.get(orientationAtom), null)
assert.equal(app.get(orientationStatusAtom), "idle")
assert.equal(app.get(permissionAtom), "prompt")
assert.deepEqual([attached, queried, requested], [[], [], []], "a dormant read did work")

const stop = app.sub(orientationAtom, () => {})
assert.deepEqual(attached, ["deviceorientation"])
const stopPermission = app.sub(permissionAtom, () => {})
assert.deepEqual(queried, ["accelerometer", "gyroscope"])
assert.deepEqual(requested, [], "subscribing must never prompt")
stop()
stopPermission()
app.dispose()

await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
