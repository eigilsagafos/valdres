import type { InitializeCallback } from "../types/InitializeCallback"
import type { TransactionInterface } from "../types/TransactionInterface"
import { setAtomPairs } from "./setAtomPairs"

/** [Docs Reference](https://valdres.dev/valdres/api/applyInitialize)
 *
 * Run an adapter's `initialize` callback inside a transaction the caller already
 * opened, then apply any `[atom, value]` pairs it returns. The one place the
 * `initialize` contract is interpreted, so every adapter (root provider and
 * scope alike) handles it identically:
 *
 * @example
 * store.txn(txn => applyInitialize(txn, options.initialize))
 *
 * Why this exists rather than inlining `if (pairs) setAtomPairs(txn.set, pairs)`
 * at each call site: a single-expression `initialize` such as
 * `txn => txn.set(atom, 1)` already wrote through `txn.set` and returns that
 * call's value (not a pair array). A truthiness guard (`if (pairs)`) then feeds
 * that stray return — e.g. a number — into `setAtomPairs`, which throws trying
 * to iterate it. The correct test is `Array.isArray`: a non-array return means
 * the callback wrote directly and there is nothing left to apply. Centralizing
 * it here keeps the rule from drifting across adapters.
 *
 * `initialize` may be `undefined` (a no-op), so adapters can forward an optional
 * option straight through.
 */
export const applyInitialize = (
    txn: TransactionInterface,
    initialize: InitializeCallback | undefined,
): void => {
    const pairs = initialize?.(txn)
    if (Array.isArray(pairs)) setAtomPairs(txn.set, pairs)
}
