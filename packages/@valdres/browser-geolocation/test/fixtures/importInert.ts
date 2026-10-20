/**
 * Fresh process with a DOM: records every geolocation call and Permissions API
 * query from BEFORE the package is imported, so import-time or read-time work
 * cannot hide behind an earlier test. Nothing here touches a real location.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { strict as assert } from "node:assert"

GlobalRegistrator.register()

const calls: string[] = []
Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
        watchPosition: () => {
            calls.push("watchPosition")
            return 1
        },
        clearWatch: () => calls.push("clearWatch"),
        getCurrentPosition: () => calls.push("getCurrentPosition"),
    },
})
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
const { geolocationAtom, permissionAtom, positionAtom, watchGeolocation } =
    await import("../../src/index")
assert.deepEqual(calls, [], "importing did work")

const app = store()
assert.equal(app.get(geolocationAtom).status, "idle")
assert.equal(app.get(permissionAtom), "prompt")
assert.deepEqual(calls, [], "a dormant read did work")

const stop = app.sub(positionAtom, () => {})
assert.deepEqual(calls, [], "subscribing to state must never start a watch")
const stopPermission = app.sub(permissionAtom, () => {})
assert.deepEqual(calls, ["query:geolocation"])
const stopWatch = watchGeolocation(app)
assert.deepEqual(calls, ["query:geolocation", "watchPosition"])
stopWatch()
assert.deepEqual(calls, ["query:geolocation", "watchPosition", "clearWatch"])
stop()
stopPermission()
app.dispose()

await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
