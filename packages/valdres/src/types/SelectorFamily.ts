import type { Selector } from "./Selector"

export type SelectorFamily<Value extends any, Args extends [any, ...any[]]> = {
    (...args: Args): Selector<Value, Args>
    release: (...args: Args) => boolean
    __valdresSelectorFamilyMap: Map<Args, Selector<Value, Args>>
}
