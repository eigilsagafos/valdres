import type { Atom, TransactionInterface } from "valdres"

type AtomPair<T> = [Atom<T>, T]

export type InitializeCallback = (
    txn: TransactionInterface,
    // @ts-ignore, @ts-todo
) => void | AtomPair[]
