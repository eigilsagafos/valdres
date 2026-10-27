const throwLater = (error: unknown): void => {
    setTimeout(() => {
        throw error
    }, 0)
}

/** The exact failure when there is one, an `AggregateError` otherwise. */
const combine = (failures: readonly unknown[], label: string): unknown =>
    failures.length === 1 ? failures[0] : new AggregateError(failures, label)

/**
 * Reports subscriber failures that happen while publishing a request's
 * progress or outcome, the way core reports `onCommit` callback failures:
 * through `globalThis.reportError` when available, otherwise by throwing in a
 * later task. If the reporter itself throws or returns a rejected thenable, a
 * later task throws an `AggregateError` with both. Never part of the request's
 * own outcome: its promise settles with what the network answered.
 */
export const reportFailures = (
    failures: readonly unknown[],
    label: string,
): void => {
    if (failures.length === 0) return
    const error = combine(failures, label)
    const failed = (failure: unknown): void =>
        throwLater(
            new AggregateError(
                [error, failure],
                `${label}; the error reporter failed too`,
            ),
        )
    try {
        const reporter = (globalThis as { reportError?: unknown }).reportError
        if (typeof reporter !== "function") return throwLater(error)
        const result: unknown = reporter.call(globalThis, error)
        if (
            result !== null &&
            (typeof result === "object" || typeof result === "function")
        )
            Promise.prototype.then.call(
                Promise.resolve(result),
                undefined,
                failed,
            )
    } catch (failure) {
        failed(failure)
    }
}
