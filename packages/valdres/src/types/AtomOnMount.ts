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
 */
export type AtomOnMount<Value = any> = (
    store: Store,
    state: Atom<Value> | Selector<Value>,
) => void | (() => void)
