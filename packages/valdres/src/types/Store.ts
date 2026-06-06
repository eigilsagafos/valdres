import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { StoreChangeCallback } from "./StoreChangeCallback"
import type { StoreData } from "./StoreData"
import type { SetAtomValue } from "./SetAtomValue"
import type { SubscribeFn } from "./SubscribeFn"
import type { TransactionFn } from "./TransactionFn"

type SetAtom = {
    <Value extends any, Args extends [any, ...any[]] = [any, ...any[]]>(
        atom: AtomFamilyAtom<Value, Args>,
        value: SetAtomValue<Value>,
    ): void
    <Value extends any>(atom: Atom<Value>, value: SetAtomValue<Value>): void
}

type DeleteAtom = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: AtomFamilyAtom<Value, Args>,
) => void

export type ScopeFn = {
    <ReturnType extends any>(scopeId: string): ScopedStore
    <ReturnType extends any>(
        scopeId: string,
        callback: (store: ScopedStore) => ReturnType,
    ): ReturnType
}

export type Store<T = StoreData> = {
    data: T
    get: GetValue
    set: SetAtom
    sub: SubscribeFn
    reset: ResetAtom
    del: DeleteAtom
    /** Run a transaction. An optional `name` is surfaced on the `meta` argument
     *  of `store.onChange` callbacks for this commit (useful for dev tools). */
    txn: (callback: TransactionFn, name?: string) => void
    scope: ScopeFn
    /** Subscribe to every atom value change in this store and its descendant
     *  scopes. The callback fires once per committed operation with all changed
     *  atoms, their new values, and the scope each change occurred in. Returns
     *  an unsubscribe function. Intended for dev tools and debugging. */
    onChange: (callback: StoreChangeCallback) => () => void
}

export type ScopedStore = Store & {
    detach: (warnIfNotDestroyed?: boolean) => void
}
