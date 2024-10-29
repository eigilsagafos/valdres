import { type Atom } from "valdres"
import type { TransactionInterface } from "./TransactionInterface"

type AtomPair<T> = [Atom<T>, T]

export type InitializeCallback = (
    txn: TransactionInterface,
    // @ts-ignore, @ts-todo
) => void | AtomPair[]
