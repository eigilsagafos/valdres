import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { AtomChange, SelectorChange, StoreChange } from "./StoreChange"
import type { StoreChangeMeta } from "./StoreChangeMeta"
import type { StoreData } from "./StoreData"
import type { SetAtomValue } from "./SetAtomValue"
import type { SubscribeFn } from "./SubscribeFn"
import type { TransactionFn } from "./TransactionFn"

type SetAtom = {
    <Value extends any, Args extends [any, ...any[]] = [any, ...any[]]>(
        atom: AtomFamilyAtom<Value, Args>,
        value: SetAtomValue<Value>,
    ): void
    <Value extends any>(atom: Atom<Value>, value: SetAtomValue<Value>): void
}

type DeleteAtom = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: AtomFamilyAtom<Value, Args>,
) => void

/** Drop a store's own value for `atom` so it reverts to what it would otherwise
 *  read — the natural inverse of `set` (cf. `git config --unset`). On a scoped
 *  store the atom re-inherits its parent's current value; on a root store it
 *  reverts to its default, removing the stored value (re-initialized lazily on
 *  the next read — unlike `reset`, which eagerly writes the default back). A
 *  no-op (no notification) when the store has no own value for the atom. Distinct
 *  from `reset` (eagerly writes the default) and `del` (removes a family
 *  member). */
type UnsetAtom = <Value extends any>(atom: Atom<Value>) => void

export type ScopeFn = {
    <ReturnType extends any>(scopeId: string): ScopedStore
    <ReturnType extends any>(
        scopeId: string,
        callback: (store: ScopedStore) => ReturnType,
    ): ReturnType
}

export type Store<T = StoreData> = {
    data: T
    get: GetValue
    set: SetAtom
    sub: SubscribeFn
    reset: ResetAtom
    del: DeleteAtom
    /** Drop a store's own value for an atom so it reverts (re-inherits the parent
     *  on a scope, reverts to the default on a root); no-op when the store holds
     *  no own value. See `UnsetAtom`. */
    unset: UnsetAtom
    /** Run a transaction. An optional `name` is surfaced on the `meta` argument
     *  of `store.onChange` callbacks for this commit (useful for dev tools). */
    txn: (callback: TransactionFn, name?: string) => void
    scope: ScopeFn
    /** Subscribe to changes in this store and its descendant scopes. The callback
     *  fires once per committed operation with the changes, the scope each
     *  occurred in, and `meta` (source / txn name). Returns an unsubscribe
     *  function. Intended for dev tools and debugging.
     *
     *  Two independent toggles select what's reported:
     *  - `atoms` (default `true`) — atom set/unset/delete changes (`AtomChange`).
     *  - `selectors` (default `false`) — derived selectors that recomputed to a
     *    new value (`SelectorChange`). Only *live* selectors (a subscriber or
     *    downstream dependent, i.e. recomputed anyway) and only genuine value
     *    changes are reported; selector reporting forces no extra evaluation.
     *
     *  The callback's `changes` type follows the options: atoms-only by default,
     *  `StoreChange[]` with `{ selectors: true }`, or `SelectorChange[]` with
     *  `{ atoms: false, selectors: true }`. Within a store's slice, atom entries
     *  precede that store's selector entries. */
    onChange: {
        (
            callback: (
                changes: readonly SelectorChange[],
                meta: StoreChangeMeta,
            ) => void,
            options: { atoms: false; selectors: true },
        ): () => void
        (
            callback: (
                changes: readonly StoreChange[],
                meta: StoreChangeMeta,
            ) => void,
            options: { atoms?: true; selectors: true },
        ): () => void
        (
            callback: (
                changes: readonly AtomChange[],
                meta: StoreChangeMeta,
            ) => void,
            // `atoms?: true` (not `boolean`): `{ atoms: false }` without
            // `selectors: true` would subscribe to nothing, so it's rejected
            // rather than typed as an atoms-only listener that never fires.
            options?: { atoms?: true; selectors?: false },
        ): () => void
    }
}

export type ScopedStore = Store & {
    detach: (warnIfNotDestroyed?: boolean) => void
}
