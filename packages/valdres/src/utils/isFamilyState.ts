import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilySelector } from "../types/AtomFamilySelector"

export const isFamilyState = <K, V>(
    state: any,
): state is AtomFamilyAtom<K, V> | AtomFamilySelector<K, V> =>
    state && Object.hasOwn(state, "family")
