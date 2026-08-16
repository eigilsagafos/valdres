import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"

/** Shared value-write site for observed and unobserved async atom resolution. */
export const applyResolvedAsyncAtomValue = <Value>(
    atom: Atom<Value>,
    resolvedValue: Value,
    data: StoreData,
) => {
    setValueInData(atom, resolvedValue, data)
    resolvePendingDefault(atom, data, resolvedValue)
}
