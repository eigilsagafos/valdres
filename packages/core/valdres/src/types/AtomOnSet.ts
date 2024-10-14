import type { StoreData } from "./StoreData"

export type AtomOnSet<Value = any> = (value: Value, store: StoreData) => void
