import type { StoreData } from "./StoreData"

export type AtomOnInit<Value = unknown> = (
    setSelf: (value: Value) => void,
    store: StoreData,
) => void
