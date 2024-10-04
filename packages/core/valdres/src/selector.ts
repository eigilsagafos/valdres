import type { GetValue } from "./types/GetValue"
import type { Selector } from "./types/Selector"
import type { SelectorOptions } from "./types/SelectorOptions"

export const selector = <Value, FamilyKey = undefined>(
    get: (get: GetValue, storeId: string) => Value,
    options?: SelectorOptions,
): Selector<Value, FamilyKey> => {
    if (!options) return { get }
    return { ...options, get }
}
