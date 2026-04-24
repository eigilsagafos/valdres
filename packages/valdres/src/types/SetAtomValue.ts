export type SetAtomValue<Value> =
    | Value
    | Promise<Value>
    | ((current: Value) => Value | Promise<Value>)
