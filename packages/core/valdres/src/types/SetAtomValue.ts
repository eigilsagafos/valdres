export type SetAtomValue<V> = V | ((current: V) => V)
