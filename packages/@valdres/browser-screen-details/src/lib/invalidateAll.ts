/**
 * Runs every invalidator, in registration order, even when an earlier one
 * throws, and returns what threw. One store tree's failing subscriber never
 * starves another.
 */
export const invalidateEach = (registrations: Set<() => void>): unknown[] => {
    const failures: unknown[] = []
    for (const invalidate of [...registrations]) {
        // Skip one removed by an earlier invalidation's subscriber; one added
        // during delivery has sampled already.
        if (!registrations.has(invalidate)) continue
        try {
            invalidate()
        } catch (error) {
            failures.push(error)
        }
    }
    return failures
}

/** The exact failure when there is one, an `AggregateError` otherwise. */
export const combineFailures = (
    failures: readonly unknown[],
    label: string,
): unknown => (failures.length === 1 ? failures[0] : new AggregateError(failures, label))

/**
 * For native event listeners: invalidates everything, then rethrows, so the
 * platform reports the failure as it does for any throwing listener.
 */
export const invalidateAll = (
    registrations: Set<() => void>,
    label: string,
): void => {
    const failures = invalidateEach(registrations)
    if (failures.length > 0) throw combineFailures(failures, label)
}
