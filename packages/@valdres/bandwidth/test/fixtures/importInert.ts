/**
 * Fresh process with a DOM: records every fetch and every listener added to
 * window, document and navigator.connection from BEFORE the package is
 * imported, so import-time or subscription-time work cannot hide behind an
 * earlier test.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { strict as assert } from "node:assert"

GlobalRegistrator.register()

const calls: string[] = []
globalThis.fetch = ((input: unknown) => {
    calls.push(`fetch:${String(input)}`)
    return new Promise(() => {})
}) as unknown as typeof fetch
const connection = new EventTarget()
Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: connection,
})
for (const [label, target] of [
    ["window", window],
    ["document", document],
    ["connection", connection],
] as const) {
    const add = target.addEventListener.bind(target)
    target.addEventListener = ((type: string, ...rest: unknown[]) => {
        calls.push(`${label}.addEventListener:${type}`)
        return (add as any)(type, ...rest)
    }) as typeof target.addEventListener
}

const { store } = await import("valdres")
const bandwidth = await import("../../src/index")
assert.deepEqual(calls, [], "importing did work")

const app = store()
assert.equal(app.get(bandwidth.measurementStatusAtom), "idle")
const stops = [
    app.sub(bandwidth.bandwidthAtom, () => {}),
    app.sub(bandwidth.downloadSpeedAtom, () => {}),
    app.scope().sub(bandwidth.lastMeasurementAtom, () => {}),
]
for (const type of ["online", "offline", "focus"])
    window.dispatchEvent(new Event(type))
document.dispatchEvent(new Event("visibilitychange"))
connection.dispatchEvent(new Event("change"))
await new Promise(resolve => setTimeout(resolve, 50))
assert.deepEqual(calls, [], "reads, subscriptions or browser events did work")

void bandwidth.measureBandwidth().catch(() => {})
assert.deepEqual(calls, ["fetch:https://speed.cloudflare.com/__down?bytes=0"])
for (const stop of stops) stop()
app.dispose()
await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
