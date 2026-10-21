/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared. Anything that reaches for a browser global unguarded throws here
 * instead of resolving against a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import {
    motionAtom,
    motionStatusAtom,
    permissionAtom,
    requestMotionPermission,
} from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")

const app = store()
assert.equal(app.get(motionAtom), null)
assert.equal(app.get(motionStatusAtom), "unsupported")
assert.equal(app.get(permissionAtom), "unsupported")
const never = () => {
    throw new Error("a DOM-less source must never notify")
}
const stops = [
    app.sub(motionAtom, never),
    app.sub(motionStatusAtom, never),
    app.sub(permissionAtom, never),
]
for (const stop of stops) stop()
assert.equal(await requestMotionPermission(), "unsupported")
for (const call of [
    () => (app as any).set(motionAtom, null),
    () => (app as any).reset(permissionAtom),
]) {
    assert.throws(call, TypeError)
}
app.dispose()
console.log("DOMLESS_OK")
