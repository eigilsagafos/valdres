import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { noteStateValueChanged } from "./stateRevisions"

export class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    constructor(promise: Promise<any>) {
        super()
        this.promise = promise
    }
}

/** Type guard for SuspendAndWaitForResolveError. Exported so consumers
 *  (e.g. the jotai adapter) can detect suspension without importing the class. */
export const isSuspendError = (
    e: unknown,
): e is { promise: Promise<any> } => {
    return e instanceof SuspendAndWaitForResolveError
}

export const cleanUpRejectedPromise = <Value>(
    selector: Selector<Value>,
    data: StoreData,
    promise: Promise<any>,
) => {
    if (data.values.has(selector) && data.values.get(selector) !== promise) return
    if (data.values.delete(selector)) {
        noteStateValueChanged(selector, data)
    }
}
