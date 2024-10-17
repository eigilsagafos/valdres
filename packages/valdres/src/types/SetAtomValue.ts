export type SetAtomValue<Value> = Value | ((current: Value) => Value)
