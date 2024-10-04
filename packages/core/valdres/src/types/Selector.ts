import type { GetValue } from "./GetValue"
import type { SelectorFamily } from "./SelectorFamily"

export type Selector<Value = unknown, FamilyKey = undefined> = {
    get: (get: GetValue, storeId: string) => Value
    debugLabel?: string
    family?: SelectorFamily<Value, FamilyKey>
    familyKey?: FamilyKey
    onMount?: () => void | (() => void)
}
