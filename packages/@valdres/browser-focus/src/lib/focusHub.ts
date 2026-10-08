import { sampleWindowFocus } from "./sampleWindowFocus"

export interface FocusHub {
    /** The focus state the window's own events last announced. */
    readonly focused: () => boolean
    /**
     * Registers one store tree's invalidator. The returned cleanup is
     * idempotent; removing the last registration detaches the hub.
     */
    readonly subscribe: (invalidate: () => void) => () => void
    /** @internal Live invalidator registrations, for tests. */
    readonly registrations: () => number
}

interface Registration {
    readonly invalidate: () => void
}

const rethrow = (failures: readonly unknown[]) => {
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1)
        throw new AggregateError(failures, "Focus invalidation failed")
}

/**
 * One `focus` and one `blur` listener on a document's window, shared by every
 * store tree that retains the focus source, and torn down with the last one.
 *
 * The state is event-derived: sampled with `sampleWindowFocus` when the hub
 * attaches, then set by the window's own `focus` / `blur` events — the
 * window-level meaning this package has always had. Once attached, the events
 * alone decide the value, so it does not depend on the engine having updated
 * `hasFocus()` / `activeElement` by the time it dispatches them.
 *
 * Every registration is invalidated after each change, in registration order,
 * even when an earlier one throws. Failures are rethrown once all of them ran
 * — the exact error when there is one, an `AggregateError` otherwise — so the
 * platform reports them from the native listener as it would for any throwing
 * listener, and one store's failure never starves another.
 */
export const createFocusHub = (
    doc: Document,
    view: Window,
    onDetach: () => void,
): FocusHub => {
    const registrations = new Set<Registration>()
    let focused = sampleWindowFocus(doc)

    const publish = (next: boolean) => {
        if (next === focused) return
        focused = next
        const failures: unknown[] = []
        for (const registration of [...registrations]) {
            // Skip a registration removed by an earlier invalidation's
            // subscriber; one added during delivery has sampled already.
            if (!registrations.has(registration)) continue
            try {
                registration.invalidate()
            } catch (error) {
                failures.push(error)
            }
        }
        rethrow(failures)
    }
    const onFocus = () => publish(true)
    const onBlur = () => publish(false)

    view.addEventListener("focus", onFocus)
    try {
        view.addEventListener("blur", onBlur)
    } catch (error) {
        view.removeEventListener("focus", onFocus)
        throw error
    }

    return {
        focused: () => focused,
        subscribe: invalidate => {
            const registration: Registration = { invalidate }
            registrations.add(registration)
            return () => {
                if (!registrations.delete(registration)) return
                if (registrations.size > 0) return
                view.removeEventListener("focus", onFocus)
                view.removeEventListener("blur", onBlur)
                onDetach()
            }
        },
        registrations: () => registrations.size,
    }
}
