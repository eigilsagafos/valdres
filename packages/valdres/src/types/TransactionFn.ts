import type { Transaction } from "../lib/transaction"

/** A transaction callback runs to completion before its writes commit.
 * Promise/thenable returns are rejected at runtime so writes after an `await`
 * cannot be silently lost. */
export type TransactionFn = (args: Transaction) => unknown
