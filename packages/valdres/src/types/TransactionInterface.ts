import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { StoreData } from "./StoreData"
import type { SyncSetAtom } from "./SyncSetAtom"
import type { TransactionFn } from "./TransactionFn"

export type TransactionInterface = {
    set: SyncSetAtom
    get: GetValue
    del: (atom: AtomFamilyAtom<any, any>) => void
    reset: ResetAtom
    /** Drop the store's own value for `atom` so it reverts (re-inherits the
     *  parent on a scope, reverts to the default on a root) — inverse of `set`. */
    unset: (atom: Atom<any>) => void
    commit: () => void
    scope: <Callback extends TransactionFn>(
        scopeId: string,
        callback: Callback,
    ) => ReturnType<Callback>
    data: StoreData
}
