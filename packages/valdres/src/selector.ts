import { createSelector } from "./lib/selectorShape"
import { equal as defaultEqual } from "./lib/equal"
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
        throw new Error(
            "selector() does not accept async functions. " +
                "Use a sync function that returns a Promise instead.",
        )
    }
    // Same trade-off as atom(): no-options selectors stay as a minimal
    // literal so chain benchmarks (which allocate N selectors per
    // iteration) keep V8's fast-path allocation. Options-bearing
    // selectors and family selectors share one hidden class via
    // createSelector.
    if (!options) {
        return { equal: defaultEqual, get } as Selector<Value, FamilyArgs>
    }
    return createSelector<Value, FamilyArgs>(
        get,
        options,
        options.name,
        undefined,
        undefined,
        undefined,
    )
}
