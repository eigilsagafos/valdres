import { describe, expect, test } from "bun:test"
import { atom } from "./atom"
import { getRegisteredAtoms } from "./getRegisteredAtoms"
import { _devListenerState } from "./lib/storeChangeListeners"
import { store } from "./store"
import { subscribeStore } from "./subscribeStore"

// NOTE: the firing/scope-bubbling behaviour of subscribeStore is exercised in
// the @valdres/redux-devtools package's tests, not here. Running a committed
// `set` while a listener is attached recompiles `propagateAtomUpdate` with its
// observation branch hot, which perturbs JSC's conservative stack scan enough
// to defeat the register-spill workaround in test/memoryleaks.test.ts (see the
// LeakDetector docs). The library does not actually leak — it's a GC-detector
// artifact — so we keep the notify-firing assertions in a process that has no
// LeakDetector suite, and verify only the zero-cost guard invariant here.

describe("subscribeStore", () => {
    test("returns an unsubscribe and balances the zero-cost guard", () => {
        const before = _devListenerState.count
        const s = store()
        const unsub = subscribeStore(s, () => {})
        expect(_devListenerState.count).toBe(before + 1)
        unsub()
        expect(_devListenerState.count).toBe(before)
        // Idempotent: a second call doesn't underflow the counter.
        unsub()
        expect(_devListenerState.count).toBe(before)
    })
})

describe("getRegisteredAtoms", () => {
    test("includes atoms declared with a name", () => {
        const named = atom(1, { name: "registry_named_atom" })
        expect(getRegisteredAtoms().get("registry_named_atom")).toBe(named)
    })

    test("excludes anonymous atoms", () => {
        const before = getRegisteredAtoms().size
        atom(1)
        expect(getRegisteredAtoms().size).toBe(before)
    })
})
