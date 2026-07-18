import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"
import { unsetValue } from "./unsetValue"
import { validateResolvedValue } from "./validateResolvedValue"

/**
 * Install and settle one asynchronous atom write.
 *
 * Both the direct set path and transaction commits route through here so
 * Promise-like normalization, stale-write protection, rollback, resolved-value
 * validation, onSet timing, suspense resolution, and propagation stay in lockstep.
 * Callers remain responsible for the initial propagation of the pending value.
 */
export const coordinateAsyncWrite = <Value>(
    atom: Atom<Value>,
    value: PromiseLike<Value>,
    currentValue: Value,
    data: StoreData,
    skipOnSet: boolean,
): Promise<Value> => {
    // Promise.resolve(realPromise) preserves the reference; bare thenables are
    // normalized so the chained rejection handler below is always available.
    const promise = Promise.resolve(value)
    // An explicit scope write can equal the Promise it currently inherits. It
    // still pins a local shadow, but if that Promise fails there is no settled
    // fallback to pin; restore the pre-write structure by re-inheriting instead.
    const rollbackInheritedWrite =
        !!data.parent && !data.values.has(atom) && currentValue === value
    setValueInData(atom, promise as Value, data)
    const rollback = () => {
        if (data.values.get(atom) !== promise) return
        if (rollbackInheritedWrite) {
            // Promise reactions run in registration order. Defer the unset one
            // turn so the ancestor coordinator gets to restore its own fallback
            // first even when a cross-scope transaction registered this child
            // coordinator before the parent's (writes are leaf-first).
            queueMicrotask(() => {
                if (data.values.get(atom) === promise) unsetValue(atom, data)
            })
            return
        }
        setValueInData(atom, currentValue, data)
        propagateAtomUpdate([atom], data, false, undefined, "async-set")
    }
    promise
        .then(resolvedValue => {
            // Last write wins, not last Promise to settle.
            if (data.values.get(atom) !== promise) return
            // Async validation cannot throw back to the original caller. Report
            // the error and restore the value observed before this write.
            if (!validateResolvedValue(atom, resolvedValue, data)) {
                rollback()
                return
            }
            setValueInData(atom, resolvedValue, data)
            if (atom.onSet && !skipOnSet) atom.onSet(resolvedValue, data)
            resolvePendingDefault(atom, data, resolvedValue)
            propagateAtomUpdate([atom], data, false, undefined, "async-set")
        })
        // Chaining catch also contains errors from the fulfilled handler (for
        // example, an onSet hook throwing) instead of leaking an unhandled
        // rejection. Only an unresolved current write is eligible for rollback.
        .catch(rollback)
    return promise
}
