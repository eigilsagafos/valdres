import type { Selector } from "./Selector"

export type AtomDefaultValue<Value = any> =
    | Value
    | (() => Value | Promise<Value>)
    | Selector<Value>
    | undefined
