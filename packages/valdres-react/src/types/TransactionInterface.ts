import type { GetValue, SetAtom, ResetAtom } from "valdres"

export type TransactionInterface = {
    set: SetAtom
    get: GetValue
    reset: ResetAtom
    commit: () => void
}
