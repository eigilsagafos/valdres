import equal from "fast-deep-equal/es6"
import type { GetValue } from "./types/GetValue"
import type { Selector } from "./types/Selector"
import type { SelectorOptions } from "./types/SelectorOptions"

export const selector = <Value, FamilyKey = undefined>(
    get: (get: GetValue, storeId: string) => Value,
    options?: SelectorOptions<Value>,
): Selector<Value, FamilyKey> => {
    if (!options) return { equal, get }
    return { equal, ...options, get }
}
