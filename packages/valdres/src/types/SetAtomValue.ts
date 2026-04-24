export type SetAtomValue<Value> =
    | Value
    | PromiseLike<Value>
    | ((current: Value) => Value | PromiseLike<Value>)
