/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared. Anything that reaches for a browser global unguarded throws here
 * instead of resolving against a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import {
    orientationAtom,
    orientationStatusAtom,
    permissionAtom,
    requestOrientationPermission,
} from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")

const app = store()
assert.equal(app.get(orientationAtom), null)
assert.equal(app.get(orientationStatusAtom), "unsupported")
assert.equal(app.get(permissionAtom), "unsupported")
const never = () => {
    throw new Error("a DOM-less source must never notify")
}
const stops = [
    app.sub(orientationAtom, never),
    app.sub(orientationStatusAtom, never),
    app.sub(permissionAtom, never),
]
for (const stop of stops) stop()
assert.equal(await requestOrientationPermission(), "unsupported")
for (const call of [
    () => (app as any).set(orientationAtom, null),
    () => (app as any).reset(permissionAtom),
]) {
    assert.throws(call, TypeError)
}
app.dispose()
console.log("DOMLESS_OK")
