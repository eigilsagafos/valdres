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
}
