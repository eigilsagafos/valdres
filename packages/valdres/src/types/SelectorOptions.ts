import type { EqualFunc } from "./EqualFunc"
import type { Schema } from "./Schema"

export type SelectorOptions<Value extends any> = {
    name?: string
    schema?: Schema<Value>
    equal?: EqualFunc<Value>
}
