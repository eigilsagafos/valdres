import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"

// Resolve an atom's default WITHOUT the init-time side effects of
// getAtomInitValue (no pendingDefaults registration, no async propagation).
// Used for read-only fallbacks — e.g. reading a family member that has been
// deleted from the store: it should yield the default value, not resurrect the
// member, and crucially must run a function default rather than return the raw
// factory. Mirrors the resolution order of getAtomInitValue.
export const resolveAtomDefaultValue = <V = any>(
    atom: Atom<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
) => {
    if (typeof atom.defaultValue === "function") {
        // @ts-ignore @ts-todo
        return atom.defaultValue()
    } else if (isSelector(atom.defaultValue)) {
        return getState(atom.defaultValue, data, initializedAtomsSet)
    }
    return atom.defaultValue
}
