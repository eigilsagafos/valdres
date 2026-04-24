export type GlobalAtomSetSelfFunc<Value = unknown> = (
    value: Value | Promise<Value> | ((current: Value) => Value | Promise<Value>),
) => void
