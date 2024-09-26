import type { GetValue } from "./GetValue"
import type { SelectorFamily } from "./SelectorFamily"

export type Selector<Value = any, FamilyKey = undefined, MountRes = unknown> = {
    get: (get: GetValue) => Value
    debugLabel?: string
    family?: SelectorFamily<Value, FamilyKey>
    familyKey?: FamilyKey
    onMount?: () => MountRes
}
