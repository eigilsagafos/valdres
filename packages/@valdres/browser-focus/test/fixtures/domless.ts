/**
 * Runs in a fresh process with no Happy-DOM registration, so `document` and
 * `window` are genuinely undeclared. Anything that reaches for them unguarded
 * throws here instead of resolving against a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { focusAtom } from "../../src/index"

assert.equal(typeof globalThis.document, "undefined")
assert.equal(typeof globalThis.window, "undefined")

const app = store()
assert.equal(app.get(focusAtom), true)

const unsub = app.sub(focusAtom, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(focusAtom), true)
unsub()

for (const call of [
    () => (app as any).set(focusAtom, false),
    () => (app as any).reset(focusAtom),
    () => (app as any).update(focusAtom, () => false),
]) {
    assert.throws(call, TypeError)
}

// A document without a browsing context cannot announce focus changes, so it
// reports the unavailable value rather than a sample that could go stale.
;(globalThis as any).document = { hasFocus: () => false, defaultView: null }
assert.equal(app.get(focusAtom), true)
app.sub(focusAtom, () => {})()
delete (globalThis as any).document

app.dispose()
console.log("DOMLESS_OK")
