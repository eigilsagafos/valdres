import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { SetAtom } from "./SetAtom"
import type { StoreData } from "./StoreData"
import type { SubscribeFn } from "./SubscribeFn"
import type { TransactionFn } from "./TransactionFn"

export type Store = {
    data: StoreData
    get: GetValue
    set: SetAtom
    sub: SubscribeFn
    reset: ResetAtom
    txn: (callback: TransactionFn) => void
}
