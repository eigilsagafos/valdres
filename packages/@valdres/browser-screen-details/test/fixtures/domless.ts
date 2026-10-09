/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared. Anything that reaches for a browser global unguarded throws here.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import {
    requestScreenDetails,
    screenDetailsAtom,
    screenPermissionAtom,
    screensAtom,
} from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")

const app = store()
assert.deepEqual(app.get(screenDetailsAtom), {
    status: "unsupported",
    screens: [],
    currentScreen: null,
    error: null,
})
assert.equal(app.get(screenPermissionAtom), "unsupported")
const never = () => {
    throw new Error("a DOM-less source must never notify")
}
const stops = [app.sub(screensAtom, never), app.sub(screenPermissionAtom, never)]
assert.equal(await requestScreenDetails(), null)
for (const stop of stops) stop()
for (const call of [
    () => (app as any).set(screensAtom, []),
    () => (app as any).reset(screenDetailsAtom),
]) {
    assert.throws(call, TypeError)
}
app.dispose()
console.log("DOMLESS_OK")
