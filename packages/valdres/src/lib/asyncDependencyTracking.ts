import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { errorBrand, errorHasBrand, markError } from "../errors/lib/errorBrand"
import { noteStateValueChanged } from "./stateRevisions"

const SUSPEND_AND_WAIT_FOR_RESOLVE_ERROR = errorBrand(
    "SuspendAndWaitForResolveError",
)

export class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    /** Preserve internal instanceof control flow across adopted copies. */
    static [Symbol.hasInstance](value: unknown): boolean {
        return errorHasBrand(value, SUSPEND_AND_WAIT_FOR_RESOLVE_ERROR)
    }

    constructor(promise: Promise<any>) {
        super()
        markError(this, SUSPEND_AND_WAIT_FOR_RESOLVE_ERROR)
        this.name = "SuspendAndWaitForResolveError"
        this.promise = promise
    }
}

/** Type guard for SuspendAndWaitForResolveError. Exported so consumers
 *  (e.g. the jotai adapter) can detect suspension without importing the class. */
export const isSuspendError = (e: unknown): e is { promise: Promise<any> } => {
    return e instanceof SuspendAndWaitForResolveError
}

export const cleanUpRejectedPromise = <Value>(
    selector: Selector<Value>,
    data: StoreData,
    promise: Promise<any>,
) => {
    if (data.values.has(selector) && data.values.get(selector) !== promise)
        return
    if (data.values.delete(selector)) {
        noteStateValueChanged(selector, data)
    }
}
