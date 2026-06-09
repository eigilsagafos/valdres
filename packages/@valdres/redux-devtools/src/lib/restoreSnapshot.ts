import type { Atom, Store, StoreData } from "valdres"
import type { DevtoolsSnapshot } from "../types/DevtoolsSnapshot"
import { COMPUTED_KEY, SCOPES_KEY } from "./snapshot"

/** Resolve a scope's StoreData by walking the path, or null if it's gone. */
const resolveScopeData = (
    rootData: StoreData,
    ids: string[],
): StoreData | null => {
    let cur: StoreData = rootData
    for (const id of ids) {
        const next = cur.scopes.get(id)
        if (!next) return null
        cur = next
    }
    return cur
}

/** Run `fn` against an existing nested scope using the side-effect-free
 *  callback form of `scope()` (it doesn't register a detach consumer). */
const withScope = (
    store: { scope: Store["scope"] },
    ids: string[],
    fn: (scoped: any) => void,
): void => {
    if (ids.length === 0) {
        fn(store)
        return
    }
    const [head, ...rest] = ids
    store.scope(head, scoped => withScope(scoped, rest, fn))
}

type ResolveAtom = (name: string) => Atom<any> | undefined

const rootValuesOf = (snapshot: DevtoolsSnapshot): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(snapshot)) {
        // @computed is derived/display-only and @scopes is handled separately.
        if (key !== SCOPES_KEY && key !== COMPUTED_KEY) out[key] = snapshot[key]
    }
    return out
}

/**
 * Reconcile one store/scope to `target`: set every atom the target names, and
 * `unset` every atom that's tracked *now* (`current`) but absent from the
 * target — i.e. atoms that first got a value after the point we're jumping to.
 * Without the second pass those would "stick" at their later value. `unset`
 * drops the store's own value, which is exactly "revert to before it was set":
 * a scope re-inherits the parent's current value, a root reverts to the default.
 * All in one `txn` so selectors recompute once.
 */
const reconcileInto = (
    txnStore: { txn: Store["txn"] },
    target: Record<string, unknown>,
    current: Record<string, unknown>,
    resolveAtom: ResolveAtom,
) => {
    txnStore.txn(t => {
        for (const name of Object.keys(target)) {
            if (name === COMPUTED_KEY) continue // derived, never restored
            const atom = resolveAtom(name)
            if (atom) t.set(atom, target[name])
        }
        for (const name of Object.keys(current)) {
            if (name === COMPUTED_KEY || name in target) continue
            const atom = resolveAtom(name)
            if (atom) t.unset(atom)
        }
    })
}

/**
 * Apply a DevTools snapshot back onto the store (time-travel). Restores all
 * tracked atoms to their values at the target point — including resetting
 * atoms that only gained a value *after* it, so jumping back doesn't leave
 * later state behind. Only atoms resolvable by name are touched; scopes that
 * no longer exist are skipped with a warning rather than resurrected.
 *
 * `current` is the live model before this restore — its keys are how we know
 * which atoms exist "now" and may need reverting. A scope override present now
 * but absent at the target was *inherited* at that point, and `unset`
 * faithfully drops the shadow so the scope re-inherits the parent again. Scopes
 * that no longer exist are skipped with a warning rather than resurrected.
 */
export const restoreSnapshot = (
    store: Store,
    target: DevtoolsSnapshot,
    current: DevtoolsSnapshot,
    resolveAtom: ResolveAtom,
    includeScopes: boolean,
): void => {
    reconcileInto(store, rootValuesOf(target), rootValuesOf(current), resolveAtom)

    if (!includeScopes) return
    const targetScopes = target[SCOPES_KEY] ?? {}
    const currentScopes = current[SCOPES_KEY] ?? {}
    const paths = new Set([
        ...Object.keys(targetScopes),
        ...Object.keys(currentScopes),
    ])
    for (const path of paths) {
        const ids = path.split("/")
        if (!resolveScopeData(store.data, ids)) {
            console.warn(
                `[@valdres/redux-devtools] Cannot restore scope "${path}" — it no longer exists. Skipping.`,
            )
            continue
        }
        withScope(store, ids, scoped =>
            reconcileInto(
                scoped,
                targetScopes[path] ?? {},
                currentScopes[path] ?? {},
                resolveAtom,
            ),
        )
    }
}
