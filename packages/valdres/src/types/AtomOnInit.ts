import type { StoreData } from "./StoreData"

/**
 * Internal cross-store sync hook for global atoms. Invoked by `initAtom`
 * the first time a given store touches the atom, so the global atom can
 * push the canonical value into the store and add the store to its
 * cross-store sync set. Not user-facing — there is no `onInit` in
 * `AtomOptions` anymore; the user-facing lifecycle is `onMount`.
 */
export type AtomOnInit<Value = unknown> = (
    setSelf: (value: Value) => void,
    store: StoreData,
) => void
