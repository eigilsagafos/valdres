import type { Selector } from "./Selector"
import type { SelectorFamily } from "./SelectorFamily"

export type AtomFamilySelector<
    Value = unknown,
    Key = unknown,
> = Selector<Value> & {
    family: SelectorFamily<Key, Value>
    familyKey: Key
}
