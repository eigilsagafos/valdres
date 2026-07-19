import { equal } from "./lib/equal"
import { nativeAsyncSelectorError } from "./lib/nativeAsyncSelectorError"
import type { GetValue } from "./types/GetValue"
import type { Selector, SelectorGetOptions } from "./types/Selector"
import type { SelectorOptions } from "./types/SelectorOptions"

export const selector = <
    Value extends any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
>(
    get: (get: GetValue, options: SelectorGetOptions) => Value | Promise<Value>,
    options?: SelectorOptions<Value>,
): Selector<Value, FamilyArgs> => {
    if (get.constructor?.name === "AsyncFunction") {
        throw nativeAsyncSelectorError("selector()")
    }
    if (!options) return { equal, get }
    return { equal, ...options, get }
}
