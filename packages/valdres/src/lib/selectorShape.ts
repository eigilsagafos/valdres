import { equal as defaultEqual } from "./equal"
import type { GetValue } from "../types/GetValue"
import type { Selector, SelectorGetOptions } from "../types/Selector"
import type { SelectorFamily } from "../types/SelectorFamily"
import type { SelectorOptions } from "../types/SelectorOptions"

// Mirror of createAtom for selectors. Every selector — plain or family
// member — runs through the same literal in the same field order, so all
// selectors share one hidden class. The core's hot paths read
// selector.equal and selector.get, both of which now hit a monomorphic
// IC instead of the megamorphic site that ad-hoc literals produced.
//
// Field order is load-bearing; see atomShape.ts.

const EMPTY_OPTIONS: SelectorOptions<any> = {}

export const createSelector = <
    V,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    get: (g: GetValue, options: SelectorGetOptions) => V | Promise<V>,
    options: SelectorOptions<V> | undefined,
    name: string | undefined,
    family: SelectorFamily<V, Args> | undefined,
    familyArgs: Args | undefined,
    familyArgsStringified: string | number | boolean | undefined,
): Selector<V, Args> => {
    const o = options || EMPTY_OPTIONS
    return {
        equal: o.equal || defaultEqual,
        get,
        name,
        onMount: undefined,
        family,
        familyArgs,
        familyArgsStringified,
    } as Selector<V, Args>
}
