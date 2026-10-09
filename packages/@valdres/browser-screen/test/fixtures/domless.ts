/**
 * Runs in a fresh process with no Happy-DOM registration: `window` and
 * `screen` are undeclared. Anything that reaches for a browser global
 * unguarded throws here instead of resolving against a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { screenAtom } from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")
assert.equal(typeof (globalThis as { screen?: unknown }).screen, "undefined")

const app = store()
const seed = app.get(screenAtom)
assert.deepEqual(seed, {
    width: 0,
    height: 0,
    availWidth: 0,
    availHeight: 0,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1,
    orientationType: "landscape-primary",
    orientationAngle: 0,
})
assert.ok(Object.isFrozen(seed))
assert.equal(
    app.get(screenAtom),
    seed,
    "the unavailable seed is one stable object",
)

const unsub = app.sub(screenAtom, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(screenAtom), seed)
unsub()

for (const call of [
    () => (app as any).set(screenAtom, seed),
    () => (app as any).reset(screenAtom),
    () => (app as any).update(screenAtom, (info: unknown) => info),
]) {
    assert.throws(call, TypeError)
}

app.dispose()
console.log("DOMLESS_OK")
