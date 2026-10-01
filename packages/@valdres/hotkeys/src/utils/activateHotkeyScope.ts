import type { Store } from "valdres"
import { trackScope } from "../lib/registry"
import { scopeCounts } from "../lib/scopeCounts"
import type { HotkeyScope } from "../types/HotkeyScope"

const isStoreDisposedError = (error: unknown) =>
    (error as { name?: unknown } | null)?.name === "StoreDisposedError"

/**
 * Activates `scope` in `store` until the returned release is called.
 * Activations count: the scope stays active while any is held. Activation is
 * store work, so it throws inside a transaction. Release is idempotent and does
 * nothing once the store is disposed.
 */
export const activateHotkeyScope = (
    store: Store,
    scope: HotkeyScope,
): (() => void) => {
    const count = scopeCounts.get(scope)
    if (count === undefined)
        throw new TypeError(
            "activateHotkeyScope needs a scope from hotkeyScope()",
        )
    store.update(count, value => value + 1)
    trackScope(store, scope, 1)
    let released = false
    return () => {
        if (released) return
        released = true
        trackScope(store, scope, -1)
        try {
            store.update(count, value => value - 1)
        } catch (error) {
            if (!isStoreDisposedError(error)) throw error
        }
    }
}
