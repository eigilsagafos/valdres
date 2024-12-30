import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { SetAtom } from "./SetAtom"

export type TransactionFn = (
    set: SetAtom,
    get: GetValue,
    reset: ResetAtom,
    commit: () => void,
    scope: (scopeId: string, callback: TransactionFn) => void,
) => void
