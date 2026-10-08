/**
 * Runs in a fresh process with no Happy-DOM registration, so `document` is a
 * genuinely undeclared identifier. Anything that reaches for it unguarded
 * throws here instead of resolving against a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { isVisibleSelector, visibilityAtom } from "../../src/index"

assert.equal(typeof globalThis.document, "undefined")

const app = store()
assert.equal(app.get(visibilityAtom), "visible")
assert.equal(app.get(isVisibleSelector), true)

const unsub = app.sub(isVisibleSelector, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(visibilityAtom), "visible")
unsub()

for (const call of [
    () => (app as any).set(visibilityAtom, "hidden"),
    () => (app as any).reset(visibilityAtom),
    () => (app as any).update(visibilityAtom, () => "hidden"),
]) {
    assert.throws(call, TypeError)
}

app.dispose()
console.log("DOMLESS_OK")
