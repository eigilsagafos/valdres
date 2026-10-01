import type { Atom, Store } from "valdres"
import { forgetExclusive, rememberExclusive } from "../lib/registry"
import { isHotkeyScope, scopeCountAtom } from "../lib/scopeState"
import type { HotkeyScope } from "../types/HotkeyScope"

const isStoreDisposedError = (error: unknown) =>
    (error as { name?: unknown } | null)?.name === "StoreDisposedError"

/** Whether `count` now holds `expected` — that is, whether a write that threw
 * had committed before it threw (a subscriber failing during notification). */
const holds = (store: Store, count: Atom<number>, expected: number) => {
    try {
        return store.get(count) === expected
    } catch {
        return false
    }
}

/**
 * Activates `scope` in exactly `store` until the returned release is called.
 * Activations count: the scope stays active in that Store while any is held.
 *
 * Both are store writes, so — like any store write — they throw inside a
 * transaction (a command) or while subscribers are being notified. A rejected
 * call changes nothing: activation throws, and release stays unreleased and can
 * be retried. If the write commits and a subscriber then throws, activation
 * writes the count back before rethrowing, so the final state is as if it never
 * happened — subscribers may still have observed the intermediate activation;
 * this restores state, it is not atomic to observers — while release counts as
 * done. Release is idempotent and does nothing once the store is disposed.
 */
export const activateHotkeyScope = (
    store: Store,
    scope: HotkeyScope,
): (() => void) => {
    if (!isHotkeyScope(scope))
        throw new TypeError(
            "activateHotkeyScope needs a scope from hotkeyScope()",
        )
    const count = scopeCountAtom(scope, store)
    const before = store.get(count)
    try {
        store.update(count, value => value + 1)
    } catch (error) {
        if (holds(store, count, before + 1)) {
            // Committed, then notification failed: restore the final count.
            // Observers may already have seen the activation; this restores
            // state, it does not make the activation unobservable.
            try {
                store.update(count, value => value - 1)
            } catch {
                // The undo commits even if notifying about it fails too.
            }
        }
        throw error
    }
    rememberExclusive(store, scope)
    let released = false
    return () => {
        if (released) return
        let current: number
        try {
            current = store.get(count)
        } catch (error) {
            if (!isStoreDisposedError(error)) throw error // e.g. inside a command
            released = true
            return
        }
        try {
            store.update(count, value => value - 1)
        } catch (error) {
            if (isStoreDisposedError(error)) {
                released = true
                return
            }
            if (!holds(store, count, current - 1)) throw error // rejected: retryable
            released = true
            if (current - 1 === 0) forgetExclusive(store, scope)
            throw error
        }
        released = true
        if (current - 1 === 0) forgetExclusive(store, scope)
    }
}
