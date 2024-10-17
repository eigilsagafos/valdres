import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import { isAtom } from "./isAtom"
import { isFamilyState } from "./isFamilyState"

export const isFamilyAtom = <K, V>(state: any): state is AtomFamilyAtom<K, V> =>
    isFamilyState(state) && isAtom(state)
