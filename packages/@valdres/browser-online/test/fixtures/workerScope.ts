/**
 * A worker's global scope has `navigator.onLine` and fires `online` /
 * `offline` on itself, with no `window`. Bun's main thread is shaped the same
 * way apart from `onLine`, so supplying that one property models a worker.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { onlineAtom } from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")
assert.equal(typeof globalThis.addEventListener, "function")

let online = false
Object.defineProperty(globalThis.navigator, "onLine", {
    configurable: true,
    get: () => online,
})
let attached = 0
const add = globalThis.addEventListener.bind(globalThis)
const remove = globalThis.removeEventListener.bind(globalThis)
;(globalThis as any).addEventListener = (type: string, listener: any) => {
    if (type === "online" || type === "offline") attached++
    add(type, listener)
}
;(globalThis as any).removeEventListener = (type: string, listener: any) => {
    if (type === "online" || type === "offline") attached--
    remove(type, listener)
}

const app = store()
assert.equal(app.get(onlineAtom), false)
assert.equal(attached, 0)

const seen: boolean[] = []
const stop = app.sub(onlineAtom, () => seen.push(app.get(onlineAtom)))
assert.equal(attached, 2)

online = true
globalThis.dispatchEvent(new Event("online"))
assert.deepEqual(seen, [true])

stop()
assert.equal(attached, 0)
app.dispose()
console.log("WORKER_SCOPE_OK")
