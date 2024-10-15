import type { AtomFamily } from "../types/AtomFamily"

export const isAtomFamily = <K, V>(state: any): state is AtomFamily<K, V> =>
    state && Object.hasOwn(state, "__valdresAtomFamilyMap")
