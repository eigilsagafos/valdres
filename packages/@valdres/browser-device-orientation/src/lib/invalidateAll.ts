/**
 * Runs every invalidator, in registration order, even when an earlier one
 * throws, then rethrows: the exact error when there is one, an
 * `AggregateError` otherwise. Thrown from a native listener, the platform
 * reports it like any throwing listener, and one store tree's failing
 * subscriber never starves another.
 */
export const invalidateAll = (
    registrations: Set<() => void>,
    label: string,
): void => {
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
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, label)
}
