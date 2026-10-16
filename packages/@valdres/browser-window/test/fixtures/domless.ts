/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared. Anything that reaches for a browser global unguarded throws here
 * instead of resolving against a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { windowSizeAtom } from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")

const app = store()
const seed = app.get(windowSizeAtom)
assert.deepEqual(seed, {
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0,
})
assert.ok(Object.isFrozen(seed))
assert.equal(
    app.get(windowSizeAtom),
    seed,
    "the unavailable seed is one stable object",
)

const unsub = app.sub(windowSizeAtom, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(windowSizeAtom), seed)
unsub()

for (const call of [
    () => (app as any).set(windowSizeAtom, seed),
    () => (app as any).reset(windowSizeAtom),
    () => (app as any).update(windowSizeAtom, (size: unknown) => size),
]) {
    assert.throws(call, TypeError)
}

app.dispose()
console.log("DOMLESS_OK")
