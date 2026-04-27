/**
 * Mount hook signature.
 *
 * Fires when the FIRST subscriber attaches to the atom (or, for global atoms,
 * when the FIRST subscriber across any store attaches). Receives the store
 * the mount happened in and the atom/selector itself, mirroring jotai's
 * `onMount`. Optionally returns a cleanup that runs when the LAST subscriber
 * detaches.
 *
 * The args are typed loosely (`any`) to avoid a circular type import between
 * `Atom`/`Selector` and `Store`. In practice the `mountAtom` runtime always
 * passes a fully-typed `Store` and `Atom`/`Selector` reference.
 */
// biome-ignore lint/suspicious/noExplicitAny: see jsdoc above
export type AtomOnMount = (store?: any, state?: any) => void | (() => void)
