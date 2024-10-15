import type { AtomFamilySelector } from "../types/AtomFamilySelector"
import { isFamilyState } from "./isFamilyState"
import { isSelector } from "./isSelector"

export const isFamilySelector = <K, V>(
    state: any,
): state is AtomFamilySelector<K, V> =>
    isFamilyState(state) && isSelector(state)
