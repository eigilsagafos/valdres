/**
 * Runs in a fresh process with no Happy-DOM registration, so `document`,
 * `window` and `navigator`-dependent code paths are genuinely undeclared.
 * Anything that reaches for a browser global unguarded throws here instead of
 * silently resolving against a test-time DOM.
 */
import { strict as assert } from "node:assert"
import { store } from "valdres"
import {
    activateKeyboard,
    keyboardAtom,
    lastKeyDownAtom,
    lastKeyDownSelector,
    modifierSelector,
    pressedCodesSelector,
    pressedKeysSelector,
    toggleKeySelector,
} from "../../src/index"

assert.equal(typeof globalThis.document, "undefined")
assert.equal(typeof globalThis.window, "undefined")

const app = store()

// Importing and reading touch no browser global and attach nothing.
const empty = app.get(keyboardAtom)
assert.deepEqual(empty, {
    pressed: [],
    locks: { CapsLock: null, NumLock: null, ScrollLock: null },
})
assert.ok(Object.isFrozen(empty))
assert.equal(app.get(keyboardAtom), empty)
assert.deepEqual(app.get(pressedKeysSelector), [])
assert.deepEqual(app.get(pressedCodesSelector), [])
assert.equal(app.get(modifierSelector("shift")), false)
assert.equal(app.get(toggleKeySelector("CapsLock")), null)
assert.equal(app.get(lastKeyDownAtom), null)
assert.equal(app.get(lastKeyDownSelector("KeyA")), null)
const stopKeyDowns = app.sub(lastKeyDownAtom, () => {
    throw new Error("a DOM-less source must never notify")
})
stopKeyDowns()

// Explicit activation is a no-op without a document.
activateKeyboard()
assert.equal(app.get(keyboardAtom), empty)

// Subscribing is a no-op that still returns a callable cleanup.
const unsub = app.sub(keyboardAtom, () => {
    throw new Error("a DOM-less source must never notify")
})
assert.equal(app.get(keyboardAtom), empty)
unsub()

for (const call of [
    () => (app as any).set(keyboardAtom, empty),
    () => (app as any).reset(keyboardAtom),
    () => (app as any).update(keyboardAtom, () => empty),
]) {
    assert.throws(call, TypeError)
}

// That server-side subscription did not mark anything activated: a document
// appearing later (a client boot in the same realm) still activates.
const attached: string[] = []
;(globalThis as any).document = {
    defaultView: null,
    visibilityState: "visible",
    addEventListener: (type: string) => attached.push(type),
    removeEventListener: () => {},
}
const later = app.sub(keyboardAtom, () => {})
assert.deepEqual(attached.sort(), ["keydown", "keyup", "visibilitychange"])
later()
delete (globalThis as any).document

app.dispose()

console.log("DOMLESS_OK")
