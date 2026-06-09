import type { StoreChangeCallback } from "../types/StoreChangeCallback"
import type { StoreData } from "../types/StoreData"
import { changeListenerRegistry } from "./notifyChangeListeners"

/** Register a store-wide change listener on `data`. The listener fires once per
 *  committed operation with the changes in this store or any descendant scope.
 *  Returns an unsubscribe function.
 *
 *  `options.atoms` (default true) and `options.selectors` (default false) select
 *  which kinds the listener receives; delivery filters per listener so each gets
 *  only what it asked for. The two global counters gate the change pipeline:
 *  `count` for "anyone watching at all", `selectorCount` for "anyone wants
 *  selectors" (so selector collection stays off the hot path otherwise). */
export const onStoreChange = (
    callback: StoreChangeCallback,
    data: StoreData,
    options?: { atoms?: boolean; selectors?: boolean },
): (() => void) => {
    const atoms = options?.atoms ?? true
    const selectors = options?.selectors ?? false

    // A listener that opts out of everything would never fire, yet registering it
    // would still flip the "is anyone watching" gates (count / changeListeners
    // size) and force per-write collection for nothing. Treat it as a no-op.
    // (The type overloads already reject this at compile time; this guards JS
    // callers and dynamic options.)
    if (!atoms && !selectors) return () => {}

    let listeners = data.changeListeners
    if (!listeners) {
        listeners = new Map()
        data.changeListeners = listeners
    }
    // Re-registering the same callback replaces its flags; adjust the counters by
    // the delta so they stay balanced regardless of registration order.
    const prev = listeners.get(callback)
    listeners.set(callback, { atoms, selectors })
    if (!prev) changeListenerRegistry.count++
    const prevSelectors = prev?.selectors ?? false
    if (selectors && !prevSelectors) changeListenerRegistry.selectorCount++
    else if (!selectors && prevSelectors) changeListenerRegistry.selectorCount--

    return () => {
        const current = data.changeListeners
        if (!current) return
        const flags = current.get(callback)
        if (flags && current.delete(callback)) {
            changeListenerRegistry.count--
            if (flags.selectors) changeListenerRegistry.selectorCount--
            // Drop the map entirely when empty so the parent-chain walk in
            // hasChangeListener stops at this store.
            if (current.size === 0) data.changeListeners = undefined
        }
    }
}
