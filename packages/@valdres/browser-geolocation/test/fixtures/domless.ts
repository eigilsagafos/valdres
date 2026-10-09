/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared and Bun's own `navigator` has no `geolocation`. Anything that
 * reaches for a browser global unguarded throws here.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import {
    geolocationAtom,
    geolocationStatusAtom,
    permissionAtom,
    positionAtom,
    watchGeolocation,
} from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")
assert.equal((globalThis.navigator as { geolocation?: unknown })?.geolocation, undefined)

const app = store()
assert.deepEqual(app.get(geolocationAtom), {
    status: "unsupported",
    position: null,
    error: null,
})
assert.equal(app.get(permissionAtom), "unsupported")
const never = () => {
    throw new Error("a DOM-less source must never notify")
}
const stops = [app.sub(positionAtom, never), app.sub(permissionAtom, never)]
const stopWatch = watchGeolocation(app)
assert.equal(app.get(geolocationStatusAtom), "unsupported")
stopWatch()
for (const stop of stops) stop()
for (const call of [
    () => (app as any).set(positionAtom, null),
    () => (app as any).reset(permissionAtom),
]) {
    assert.throws(call, TypeError)
}
app.dispose()
console.log("DOMLESS_OK")
