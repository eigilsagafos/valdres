import type { Atom } from "./Atom"
import type { TransactionInterface } from "./TransactionInterface"

/** The store-initialization callback every framework adapter accepts (root
 *  provider and scope alike). Runs inside a transaction on the fresh store; it
 *  can either write through the transaction directly (`txn.set(...)`) and
 *  return nothing, or return `[atom, value]` pairs for the caller to apply —
 *  see `setAtomPairs`.
 *
 *  Typed against `TransactionInterface`, which the `Transaction` passed by
 *  `store.txn` structurally satisfies — so adapters can forward their
 *  `initialize` straight into `store.txn` without casts. */
export type InitializeCallback = (
    txn: TransactionInterface,
) => void | [Atom<any>, any][]
