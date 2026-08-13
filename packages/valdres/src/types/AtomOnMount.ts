import type { Atom } from "./Atom"
import type { Selector } from "./Selector"
import type { Store } from "./Store"

/**
 * Mount hook signature.
 *
 * Fires when the FIRST subscriber attaches to the atom (or, for global atoms,
 * when the FIRST subscriber across any store attaches). Receives the store
 * the mount happened in and the atom/selector itself, mirroring jotai's
 * `onMount`. Optionally returns a cleanup that runs when the LAST subscriber
 * detaches.
 *
 * CONTRACT: `onMount` must be set before the atom/selector is first used in a
 * store (first read, subscribed, or pulled in as a dependency). Setting it at
 * creation, or assigning it afterward but before first use (as the jotai
 * adapter does), both satisfy this. Assigning `onMount` AFTER the state is
 * already participating in a store is unsupported and is not guaranteed to take
 * effect: the engine caches per store whether a dependency closure can reach a
 * mount hook, and that cache is populated as dependency edges form, so a hook
 * attached after those edges already exist may never be discovered.
 *
 * Both parameters are always passed by `mountAtom`. They are declared required
 * rather than optional because a hook that ignores them — the common
 * `onMount: () => bootstrap(thisAtom)` shape — stays assignable either way,
 * while required parameters give the hooks that DO use them real types instead
 * of `any`. The `Store`/`Atom`/`Selector` references here form a type-level
 * cycle back to this module, which TypeScript resolves lazily; only the
 * runtime `mountAtom` -> user-hook direction is a real dependency.
 *
 * `State` defaults to the `Atom | Selector` union because that is what the
 * declaration site genuinely knows: `Atom.onMount` and `Selector.onMount` must
 * keep the SAME type, since `Selector` is structurally assignable to `Atom`
 * (every `Atom` field but `equal` is optional) and the engine relies on that
 * throughout init and propagation. Giving each its own state type breaks the
 * relationship and fails to compile in `initSelector`, `mountAtom`,
 * `propagateUpdatedAtoms`, and `storeFromStoreData`.
 *
 * Narrow it at the USE site instead when a hook needs fields only one side has
 * — `defaultValue` on an atom, `get` on a selector. The narrowed hook still
 * assigns into `atom()`/`AtomOptions` because parameters are contravariant:
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
