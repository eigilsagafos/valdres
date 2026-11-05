import { reportFailures } from "./reportFailure"

/** Refusals that only mean "not now": the store tree is inside a transaction
 *  or a settle handler, where external invalidation is not allowed. */
const DEFERRABLE = ["CallbackCapabilityError", "TransactionPhaseError"]
const isDeferrable = (error: unknown) =>
    DEFERRABLE.includes(String((error as { name?: unknown } | null)?.name))

const deliver = (
    registrations: Set<() => void>,
    targets: readonly (() => void)[],
    label: string,
): void => {
    const failures: unknown[] = []
    for (const invalidate of targets) {
        // Skip one released by an earlier invalidation's subscriber.
        if (!registrations.has(invalidate)) continue
        try {
            invalidate()
        } catch (error) {
            if (isDeferrable(error))
                queueMicrotask(() =>
                    deliver(registrations, [invalidate], label),
                )
            else failures.push(error)
        }
    }
    reportFailures(failures, label)
}

/**
 * Invalidates every registered store tree, in registration order, even when
 * an earlier one throws, so one store's throwing subscriber never starves
 * another. Subscriber failures are reported (see `reportFailures`), never
 * thrown: they must not become the outcome of the measurement whose progress
 * was being published. A tree that refuses because it is inside a transaction or
 * settle handler is invalidated again in a microtask, once that work is over,
 * so it never keeps serving an outdated snapshot.
 */
export const notifyAll = (
    registrations: Set<() => void>,
    label: string,
): void => deliver(registrations, [...registrations], label)
