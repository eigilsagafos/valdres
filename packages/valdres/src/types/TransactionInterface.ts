import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { SetAtom } from "./SetAtom"
import type { TransactionFn } from "./TransactionFn"

export type TransactionInterface = {
    set: SetAtom
    get: GetValue
    reset: ResetAtom
    commit: () => void
    scope: <Callback extends TransactionFn>(
        scopeId: string,
        callback: Callback,
    ) => ReturnType<Callback>
}
