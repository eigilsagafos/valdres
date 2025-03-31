import type { EqualFunc } from "./EqualFunc"
import type { GetValue } from "./GetValue"
import type { SelectorFamily } from "./SelectorFamily"

export type Selector<
    Value extends any = any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
> = {
    get: (get: GetValue, storeId: string) => Value | Promise<Value>
    equal: EqualFunc<Value>
    name?: string
    family?: SelectorFamily<Value, FamilyArgs>
    familyArgs?: FamilyArgs
    onMount?: () => void | (() => void)
}
