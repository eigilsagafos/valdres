import type { Store } from "./Store"

export type AtomOnSet<Value = any> = (value: Value, store: Store) => void
