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
 * The args are typed loosely (`any`) to avoid a circular type import between
 * `Atom`/`Selector` and `Store`. In practice the `mountAtom` runtime always
 * passes a fully-typed `Store` and `Atom`/`Selector` reference.
 */
// biome-ignore lint/suspicious/noExplicitAny: see jsdoc above
export type AtomOnMount = (store?: any, state?: any) => void | (() => void)
