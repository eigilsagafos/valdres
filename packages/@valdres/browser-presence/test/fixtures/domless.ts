/**
 * Runs in a fresh process with no Happy-DOM registration, so `document` and
 * `window` are genuinely undeclared — for this package and both packages it
 * composes.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { presenceSelector } from "../../src/index"

assert.equal(typeof globalThis.document, "undefined")
assert.equal(typeof globalThis.window, "undefined")

const app = store()
assert.equal(app.get(presenceSelector), true)

const unsub = app.sub(presenceSelector, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(presenceSelector), true)
unsub()
assert.throws(() => (app as any).set(presenceSelector, false), TypeError)

app.dispose()
console.log("DOMLESS_OK")
