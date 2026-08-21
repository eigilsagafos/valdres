import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { SchemaValidationError } from "../errors/SchemaValidationError"
import type { GetValue } from "./GetValue"
import type { ResetAtom } from "./ResetAtom"
import type { SetAtom } from "./SetAtom"
import type { TransactionFn } from "./TransactionFn"

/** The operations available while a `store.txn` callback is running.
 *
 * Transaction lifecycle and backing store data are deliberately absent: the
 * callback either returns successfully and Valdres commits, or throws and
 * Valdres discards every staged write. */
export type Transaction = {
    set: SetAtom
    get: GetValue
    del: (atom: AtomFamilyAtom<any, any>) => void
    reset: ResetAtom
    /** Drop the store's own value for `atom` so it reverts (re-inherits the
     *  parent on a scope, reverts to the default on a root) — inverse of `set`. */
    unset: (atom: Atom<any>) => void
    /** Open `scopeId` for the rest of this transaction. The scope's writes
     *  commit atomically with the enclosing transaction's, and the callback
     *  receives a `ScopedTransaction` — every operation here plus `unsetAll`.
     *  Throws if the scope does not exist. */
    scope: <Callback extends ScopedTransactionFn>(
        scopeId: string,
        callback: Callback,
    ) => ReturnType<Callback>
    /** Step out to the parent store's transaction. The parent may itself be the
     *  root, so the callback receives a plain `Transaction`. */
    parentScope: <Callback extends TransactionFn>(
        callback: Callback,
    ) => ReturnType<Callback>
    /** Stage a family-sized write without rebuilding its membership index for
     *  every member. Primarily used by hydration and bulk-data adapters. */
    batchSetFamilyAtoms: (
        family: AtomFamily<any, [any, ...any[]]>,
        pairs: Iterable<readonly [Atom<any>, any]>,
        onSchemaError?: (error: SchemaValidationError) => void,
    ) => void
}

/** A transaction opened against a SCOPE — `txn.scope(id, …)`, or `store.txn` on
 *  a scoped store. Adds the one operation that only makes sense where there is
 *  a parent to fall back to. */
export type ScopedTransaction = Transaction & {
    /** Stage a revert of every value this scope owns — atom values and its
     *  atom-family membership — into this transaction's commit, so the whole
     *  scope falls back to what it inherits without leaving the scope itself.
     *  The staged form of `ScopedStore.unsetAll()`; see that method for the full
     *  semantics. Values this transaction staged for the scope go too (last
     *  write wins, as with `unset`), and a later `set` in the same transaction
     *  re-establishes that atom normally. */
    unsetAll: () => void
}

/** A transaction callback that receives a scoped transaction. */
export type ScopedTransactionFn = (args: ScopedTransaction) => unknown
