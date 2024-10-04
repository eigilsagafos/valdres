import type { StoreData } from "./StoreData"

export type AtomOnSet<Value = unknown> = (
    value: Value,
    store: StoreData,
) => void
