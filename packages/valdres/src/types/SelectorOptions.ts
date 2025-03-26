import type { EqualFunc } from "./EqualFunc"

export type SelectorOptions<Value extends any> = {
    name?: string
    equal?: EqualFunc<Value>
}
