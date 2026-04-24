import type { SetAtomValue } from "./SetAtomValue"

export type GlobalAtomSetSelfFunc<Value = unknown> = (
    value: SetAtomValue<Value>,
) => void
