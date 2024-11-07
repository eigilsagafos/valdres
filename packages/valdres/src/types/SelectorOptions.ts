import type { EqualFunc } from "./EqualFunc"

export type SelectorOptions<Value> = {
    name?: string
    equal?: EqualFunc<Value>
}
