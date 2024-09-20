import type { GetValue } from "./GetValue"
import type { SelectorFamily } from "./SelectorFamily"

export type Selector<V = any> = {
    get: (get: GetValue) => V
    debugLabel?: string
    family?: SelectorFamily<any, V>
}
