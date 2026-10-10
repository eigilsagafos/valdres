import { JotaiCompatibilityError } from "./errors"
import type { AnyAtomConfig } from "./nodeRegistry"

export type Outcome = (
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: unknown }
) & {
    /** The atom's own stored value (init or last set) when it was computed. */
    readonly stored: unknown
}

export interface LifecycleSink {
    mounted(config: AnyAtomConfig): void
    unmounted(config: AnyAtomConfig): void
    /** The last installed outcome of a self-reading config in this store. */
    previousOutcome(config: AnyAtomConfig): Outcome | undefined
    /** Record an installed outcome; ignored for discarded (staged) reads. */
    recordOutcome(config: AnyAtomConfig, outcome: Outcome): void
}

// Valdres attaches and detaches an ExternalAtom synchronously inside the Store
// operation that retained or released it, and evaluates selectors inside the
// operation that reads them, but neither callback is told which Store tree that
// is. Every Valdres call a Jotai store makes runs inside `withOperation`, so
// the innermost entry is the Store being operated on. This holds only while
// each Jotai store owns a private root Valdres Store, creates no scopes and
// wraps every call.
const stack: LifecycleSink[] = []

export const withOperation = <T>(
    sink: LifecycleSink,
    operation: () => T,
): T => {
    stack.push(sink)
    try {
        return operation()
    } finally {
        stack.pop()
    }
}

export const currentSink = (): LifecycleSink => {
    const sink = stack[stack.length - 1]
    if (sink === undefined) {
        throw new JotaiCompatibilityError(
            "VALDRES_JOTAI_LIFECYCLE_OUTSIDE_OPERATION",
            "A Jotai atom was mounted outside a @valdres-react/jotai store operation.",
        )
    }
    return sink
}
