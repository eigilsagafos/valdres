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
    scope: <Callback extends TransactionFn>(
        scopeId: string,
        callback: Callback,
    ) => ReturnType<Callback>
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
