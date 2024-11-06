import type { EqualFunc } from "./EqualFunc"

export type SelectorOptions<Value> = {
    label?: string
    equal?: EqualFunc<Value>
}
