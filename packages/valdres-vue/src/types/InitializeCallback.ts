import type { Atom, Transaction } from "valdres"

type AtomPair = [Atom<any>, any]

export type InitializeCallback = (
    txn: Transaction,
) => void | AtomPair[]
