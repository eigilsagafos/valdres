/**
 * Runs in a fresh process with no Happy-DOM registration, so `window` is a
 * genuinely undeclared identifier. Anything that reaches for a browser global
 * unguarded throws `ReferenceError` here instead of silently resolving against
 * a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import { colorSchemeAtom, isDarkSelector, isLightSelector } from "../../src/index"

assert.equal(typeof globalThis.window, "undefined")

const app = store()

// Importing and reading must not touch a browser global or attach anything.
assert.equal(app.get(colorSchemeAtom), "light")
assert.equal(app.get(isDarkSelector), false)
assert.equal(app.get(isLightSelector), true)

// Subscribing is a no-op that still returns a callable cleanup.
const unsub = app.sub(colorSchemeAtom, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(colorSchemeAtom), "light")
unsub()

app.dispose()

console.log("DOMLESS_OK")
