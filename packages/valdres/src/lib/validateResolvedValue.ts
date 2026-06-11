import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { reportAsyncSchemaError } from "./reportAsyncSchemaError"
import { validateSchema } from "./validateSchema"

/**
 * Validate a value that arrived asynchronously (a promise resolved to it).
 *
 * Returns `true` when the value is valid (or validation is off) — the caller
 * commits it. Returns `false` when it's invalid: the failure has already been
 * reported via `reportAsyncSchemaError`, and the caller MUST NOT commit the
 * value (it runs its own cleanup — revert / drop / cleanUpRejectedPromise).
 *
 * Every async validate-on-resolve boundary routes through here — atom set, atom
 * function default, atom selector default, selector evaluation, and the
 * deleted-family-member read in getState — so a new boundary can't silently
 * skip validation. (Async validation can't throw to the original caller, which
 * is why the failure is reported rather than thrown; sync boundaries call
 * `validateSchema` directly and it throws to the caller.)
 */
export const validateResolvedValue = (
    state: Atom<any> | Selector<any>,
    value: unknown,
    data: StoreData,
): boolean => {
    try {
        validateSchema(state, value, data)
        return true
    } catch (err) {
        reportAsyncSchemaError(err)
        return false
    }
}
