import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
// import type { SetAtom } from "./SetAtom"
import type { StoreData } from "./StoreData"
import type { SubscribeFn } from "./SubscribeFn"
import type { TransactionFn } from "./TransactionFn"

type SetAtom = {
    <V, K>(atom: AtomFamilyAtom<K, V>, value: V): void
    <V>(atom: Atom<V>, value: V): void
}

export type Store = {
    data: StoreData
    get: GetValue
    set: SetAtom
    sub: SubscribeFn
    reset: ResetAtom
    txn: (callback: TransactionFn) => void
    scope: (scopeId: string, callback: (scopedStore: Store) => void) => void
}
