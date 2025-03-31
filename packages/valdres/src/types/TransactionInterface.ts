import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { SetAtom } from "./SetAtom"
import type { StoreData } from "./StoreData"
import type { TransactionFn } from "./TransactionFn"

export type SetAtom2 = {
    <V>(atom: Atom<V>, value: V): V
    // <V>(selector: Selector<V>): V
    // <V, K>(family: AtomFamily<K, V>): K[]
}

export type TransactionInterface = {
    set: SetAtom
    get: GetValue
    del: (atom: AtomFamilyAtom<any, any>) => void
    reset: ResetAtom
    commit: () => void
    scope: <Callback extends TransactionFn>(
        scopeId: string,
        callback: Callback,
    ) => ReturnType<Callback>
    data: StoreData
}
