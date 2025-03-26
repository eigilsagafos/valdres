import { equal } from "./lib/equal"
import type { GetValue } from "./types/GetValue"
import type { Selector } from "./types/Selector"
import type { SelectorOptions } from "./types/SelectorOptions"

export const selector = <
    Value extends any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
>(
    get: (get: GetValue, storeId: string) => Value | Promise<Value>,
    options?: SelectorOptions<Value>,
): Selector<Value, FamilyArgs> => {
    if (!options) return { equal, get }
    return { equal, ...options, get }
}
