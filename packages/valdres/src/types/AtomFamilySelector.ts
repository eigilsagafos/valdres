import type { Selector } from "./Selector"
import type { SelectorFamily } from "./SelectorFamily"

export type AtomFamilySelector<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = Selector<Value> & {
    family: SelectorFamily<Value, Args>
    familyKey: Args
}
