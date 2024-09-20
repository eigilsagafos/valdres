import type { SelectorFamily } from "./SelectorFamily"
import type { AtomFamily } from "./AtomFamily"

export type Family<V, K = any> = AtomFamily<V, K> | SelectorFamily<V, K>
