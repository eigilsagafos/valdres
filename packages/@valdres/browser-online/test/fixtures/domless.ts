/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared and Bun's own `navigator` has no `onLine`. Anything that reaches
 * for a browser global unguarded throws here instead of resolving against a
 * test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { onlineAtom } from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")
assert.equal(typeof globalThis.navigator?.onLine, "undefined")

const app = store()
assert.equal(app.get(onlineAtom), true)

const unsub = app.sub(onlineAtom, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(onlineAtom), true)
unsub()

for (const call of [
    () => (app as any).set(onlineAtom, false),
    () => (app as any).reset(onlineAtom),
    () => (app as any).update(onlineAtom, () => false),
]) {
    assert.throws(call, TypeError)
}

app.dispose()
console.log("DOMLESS_OK")
