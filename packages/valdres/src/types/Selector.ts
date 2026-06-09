import type { AtomOnMount } from "./AtomOnMount"
import type { EqualFunc } from "./EqualFunc"
import type { GetValue } from "./GetValue"
import type { SelectorFamily } from "./SelectorFamily"

export type SelectorGetOptions = {
    signal: AbortSignal
    storeId: string
}

export type Selector<
    Value extends any = any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
> = {
    get: (get: GetValue, options: SelectorGetOptions) => Value | Promise<Value>
    equal: EqualFunc<Value>
    name?: string
    family?: SelectorFamily<Value, FamilyArgs>
    familyArgs?: FamilyArgs
    onMount?: AtomOnMount
    /** Internal: compat-layer override for onMount. Not user-facing. */
    __valdresOnMount?: AtomOnMount
    /** Internal: marks selectors created by valdres itself (e.g. the cacheMeta
     *  selector backing maxAge/stale-while-revalidate). Excluded by
     *  `store.onChange` and `store.snapshot` so dev tools don't surface
     *  implementation-detail churn. */
    __valdresInternal?: boolean
}
