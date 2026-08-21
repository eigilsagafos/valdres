import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { SnapshotEntry } from "./SnapshotEntry"
import type { AtomChange, SelectorChange, StoreChange } from "./StoreChange"
import type { StoreChangeMeta } from "./StoreChangeMeta"
import type { SetAtom } from "./SetAtom"
import type { SubscribeFn } from "./SubscribeFn"
import type { ScopedTransactionFn } from "./Transaction"
import type { TransactionFn } from "./TransactionFn"

/** Remove a family member from THIS store: its value goes, and it leaves this
 *  store's `get(family)` membership list.
 *
 *  On a scope that is a local removal, not a tree-wide one, and the two read
 *  paths then answer differently on purpose: `get(family)` omits the member,
 *  while `get(family(key))` still returns the PARENT's value, because a value
 *  read with no local value falls through the scope chain as it always does. The
 *  scope is saying "not one of mine", not "gone everywhere" — the parent and its
 *  other scopes are untouched. On a root store there is nothing to fall through
 *  to, so the member reads its family default.
 *
 *  `ScopedStore.unsetAll()` reverts a scope-local delete along with everything
 *  else the scope owns, putting the member back in its membership list. */
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

/** The scope handed to the callback form of `scope()`: every scope operation,
 *  minus the lifecycle ownership a lease carries. */
export type BorrowedScopedStore = Omit<ScopedStore, "dispose" | "detach">

export type ScopeFn = {
    /** Acquire a scope lease. The caller owns the returned `detach`. */
    (scopeId: string): ScopedStore
    /** Borrow an existing scope for the duration of `callback`. A borrowed
     * store has no lifecycle ownership, so it cannot be disposed or detached. */
    <Result>(
        scopeId: string,
        callback: (store: BorrowedScopedStore) => Result,
    ): Result
}

export type Store = {
    /** Stable identity for this store or scope. Runtime internals are private. */
    readonly id: string
    /** Terminally release this store and its descendant scopes. Disposal drains
     *  subscriptions, mounts, timers, change/commit listeners, pending batches,
     *  async selector work, and global-atom registrations. Every later store
     *  operation throws `StoreDisposedError`; repeated disposal is a no-op. Call
     *  this for request/SSR stores when the request completes. The process-wide
     *  `globalStore` cannot be disposed. */
    dispose: () => void
    get: GetValue
    set: SetAtom
    sub: SubscribeFn
    reset: ResetAtom
    del: DeleteAtom
    /** Drop a store's own value for an atom so it reverts (re-inherits the parent
     *  on a scope, reverts to the default on a root); no-op when the store holds
     *  no own value. See `UnsetAtom`. */
    unset: UnsetAtom
    /** Run a synchronous transaction and return whatever the callback returned —
     *  the same contract the callback forms of `scope()` carry, so a value read
     *  against the transaction's view can come straight back out. Promise and
     *  thenable callbacks are rejected at runtime, so a transaction cannot be
     *  used to await anything. An optional `name` is surfaced on the `meta`
     *  argument of `store.onChange` callbacks for this commit (useful for dev
     *  tools). */
    txn: <Callback extends TransactionFn>(
        callback: Callback,
        name?: string,
    ) => ReturnType<Callback>
    scope: ScopeFn
    /** Whether this store has a child scope with `scopeId` — its OWN children
     *  only, not a search of the tree.
     *
     *  The same question `scope(scopeId, callback)` answers by throwing, without
     *  making a consumer catch to find out. Depth composes through `scope()`
     *  rather than a path argument: `store.scope("a", s => s.hasScope("b"))`.
     *  A scope exists from the first `scope(scopeId)` until its last lease
     *  detaches, so this also reports whether the id is currently live rather
     *  than merely once-used. */
    hasScope: (scopeId: string) => boolean
    /** Run `callback` when this store is disposed — when `dispose()` is called
     *  on it, when an ancestor is disposed, or, for a scope, when its LAST lease
     *  detaches. Returns a function that cancels the registration.
     *
     *  For resources a consumer owns ALONGSIDE the store and must release with
     *  it: an adapter's per-scope cache, a subscription to something external, a
     *  timer. A scope's death is otherwise unobservable from a single lease —
     *  the holder knows when IT detaches, not whether it was the last — so the
     *  alternative is inferring it on the next acquire, which cannot distinguish
     *  a surviving scope from a new one that reuses the id.
     *
     *  The store is already terminal when the callback runs, so every operation
     *  on it throws `StoreDisposedError`; read what you need beforehand and
     *  close over it. Every registered callback runs even if an earlier one
     *  throws, and the first error is rethrown to whoever called `dispose()`.
     *  Per-atom setup instead belongs in `onMount`, whose cleanup runs when the
     *  last subscriber leaves rather than when the store dies.
     *
     *  Each call is an independent registration: the same function passed twice
     *  runs twice, and each returned canceller removes only its own. Unlike
     *  `onChange`/`onCommitEnd`, which dedupe by callback identity — for a
     *  cleanup, skipping a registered release is a leak the caller cannot see,
     *  while running one twice is a bug they can. */
    onDispose: (callback: () => void) => () => void
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
    /** Subscribe to commit boundaries: the callback fires exactly once per
     *  commit — a `set`, `reset`, `del`, `unset`, async resolution, or
     *  `store.txn`/batched flush — strictly AFTER every subscriber callback of
     *  that commit (and after `store.onChange`). Returns an unsubscribe
     *  function.
     *
     *  Carries no payload by design: where `onChange` is a devtools pipeline
     *  that constructs change objects, this is a minimal signal for adapters
     *  that buffer subscriber updates and flush them once per commit (e.g.
     *  coalescing one commit's writes into a single framework batch). With no
     *  listener registered it costs one counter read per commit — nothing is
     *  tracked or allocated.
     *
     *  Tree-wide: listeners attach to the store tree's ROOT, so a commit
     *  anywhere in the tree (root or any scope) fires listeners registered
     *  through any store of that tree — a root write that propagates into
     *  scopes and a scope-local write both end in the same flush. Writes
     *  performed during the commit by subscribers (or onSet hooks) start
     *  nested commits that coalesce into the outermost commit's single
     *  callback. */
    onCommitEnd: (callback: () => void) => () => void
    /** List the store's current materialized state — every atom (root and
     *  scope), live evaluated selector, and family member — as a flat array of
     *  `SnapshotEntry`. Where `onChange` reports changes going forward, this is
     *  the state that already exists, for a dev-tools consumer connecting late.
     *
     *  Opt-in: only a store created with `store(id, { enumerable: true })`
     *  retains its values enumerably. On a default store the values live in a
     *  `WeakMap` and can't be listed, so `snapshot()` returns `[]` and warns
     *  once. Internal states and family containers are excluded; entries carry
     *  the same `scope` id path as `onChange`. */
    snapshot: () => SnapshotEntry[]
}

/** Drop every value a scope owns, so the scope reverts wholesale to what it
 *  inherits — the whole-scope form of `unset`, and the counterpart to
 *  `detach()`: where detaching releases a lease (and destroys the scope with the
 *  last one), this empties the scope but keeps it alive and reusable.
 *
 *  Every atom the scope shadows re-inherits its parent's current value and
 *  resumes tracking it, and the scope's atom-family membership reverts to its
 *  parent's in BOTH directions — members the scope added leave its
 *  `get(family)`, members it deleted come back. It all lands in a single
 *  commit, so no subscriber sees the scope half-reverted.
 *
 *  Notification follows `unset`: every atom whose own value was dropped
 *  notifies, INCLUDING one whose inherited value turns out to be equal — the
 *  scope genuinely stopped owning it, and the per-atom primitive reports that
 *  the same way. Atoms the scope never shadowed are untouched and silent.
 *
 *  Scope identity, leases, subscriptions, and nested scopes are untouched;
 *  values a nested scope owns are its own and stay (it re-inherits whatever this
 *  scope now reads). Idempotent, and a no-op on a scope that owns nothing.
 *
 *  Only meaningful on a scope: a root store has no parent to revert to, and
 *  calling it there throws — `unsetAll` is typed onto `ScopedStore`, so that is
 *  a compile error rather than a surprise.
 *
 *  Inside a transaction it stages instead of committing, so the revert lands in
 *  that commit: `scope.txn(txn => txn.unsetAll())` from the scope itself, or
 *  `txn.scope(scopeId, txn => txn.unsetAll())` when the parent drives the
 *  commit (publishing a draft and clearing it, say). */
type UnsetAllValues = () => void

export type ScopedStore = Store & {
    detach: (warnIfNotDestroyed?: boolean) => void
    /** As `Store.txn`, but the callback receives a `ScopedTransaction` — so a
     *  scope's own transaction can `unsetAll()` directly, without going back
     *  through the parent's `txn.scope(id, …)`. */
    txn: <Callback extends ScopedTransactionFn>(
        callback: Callback,
        name?: string,
    ) => ReturnType<Callback>
    /** Revert every value this scope owns to what it inherits, keeping the
     *  scope alive. See `UnsetAllValues`. */
    unsetAll: UnsetAllValues
}
