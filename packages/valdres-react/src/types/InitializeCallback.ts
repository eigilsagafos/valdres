import type { Atom, Transaction } from "valdres"

type AtomPair<T> = [Atom<T>, T]

export type InitializeCallback = (
    txn: Transaction,
    // @ts-ignore, @ts-todo
) => void | AtomPair[]
