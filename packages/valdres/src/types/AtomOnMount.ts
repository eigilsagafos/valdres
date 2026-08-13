import type { Atom } from "./Atom"
import type { Selector } from "./Selector"
import type { Store } from "./Store"

// ── Maintainer notes (deliberately NOT JSDoc: declaration emit copies JSDoc
// into the shipped .d.ts, and this is rationale for us, not for consumers) ────
//
// Both parameters are always passed by `mountAtom`. They are required rather
// than optional because a hook that ignores them stays assignable either way,
// while required parameters give the hooks that DO use them real types.
//
// The `Store`/`Atom`/`Selector` references form a type-level cycle back to this
// module, which TypeScript resolves lazily; only the runtime `mountAtom` ->
// user-hook direction is a real dependency.
//
// `State` defaults to the union because that is what the declaration site
// knows: `Atom.onMount` and `Selector.onMount` must keep the SAME type, since
// `Selector` is structurally assignable to `Atom` (every `Atom` field but
// `equal` is optional) and the engine relies on that throughout init and
// propagation. Threading a distinct state type through each fails to compile in
// `initSelector`, `mountAtom`, `propagateUpdatedAtoms`, and
// `storeFromStoreData` — narrow at the use site instead.

/**
 * Mount hook signature.
 *
 * Fires when the FIRST subscriber attaches to the atom (or, for global atoms,
 * when the FIRST subscriber across any store attaches). Receives the store the
 * mount happened in and the atom/selector itself, mirroring jotai's `onMount`.
 * Optionally returns a cleanup that runs when the LAST subscriber detaches.
 *
 * CONTRACT: `onMount` must be set before the atom/selector is first used in a
 * store (first read, subscribed, or pulled in as a dependency). Setting it at
 * creation, or assigning it afterward but before first use (as the jotai
 * adapter does), both satisfy this. Assigning `onMount` AFTER the state is
 * already participating in a store is unsupported: the engine caches per store
 * whether a dependency closure can reach a mount hook, and that cache is
 * populated as dependency edges form, so a hook attached after those edges
 * exist may never be discovered.
 *
 * Narrow `State` when a hook needs fields only one side has. The narrowed hook
 * still assigns into `atom()` because parameters are contravariant:
 *
 * ```ts
 * const onMount: AtomOnMount<number, Atom<number>> = (store, state) => {
 *     console.log(state.defaultValue) // atom-only field, no narrowing needed
 * }
 * atom(0, { onMount })
 * ```
 */
export type AtomOnMount<Value = any, State = Atom<Value> | Selector<Value>> = (
    store: Store,
    state: State,
) => void | (() => void)
