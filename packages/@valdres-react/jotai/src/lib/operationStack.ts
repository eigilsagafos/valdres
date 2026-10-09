import { JotaiCompatibilityError } from "./errors"
import type { AnyAtomConfig } from "./nodeRegistry"

export interface LifecycleSink {
    mounted(config: AnyAtomConfig): void
    unmounted(config: AnyAtomConfig): void
}

// Valdres attaches and detaches an ExternalAtom synchronously inside the Store
// operation that retained or released it, but the source callback is not told
// which Store that is. Every Valdres call a Jotai store makes runs inside
// `withOperation`, so the innermost entry is the Store being operated on.
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
