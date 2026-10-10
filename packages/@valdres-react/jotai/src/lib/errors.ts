// Valdres wraps a selector failure in SelectorGetterError / SelectorDependencyError
// chains. Jotai surfaces exactly what the read function threw, so the adapter
// follows `cause` through those two documented wrapper codes, and only those:
// every other Valdres error (cycles, capability and phase errors) is a real
// boundary and propagates unchanged.
const WRAPPER_CODES: ReadonlySet<unknown> = new Set([
    "VALDRES_SELECTOR_GETTER_ERROR",
    "VALDRES_SELECTOR_DEPENDENCY_ERROR",
])

export const unwrapAtomError = (error: unknown): unknown => {
    while (
        error instanceof Error &&
        WRAPPER_CODES.has((error as { code?: unknown }).code)
    ) {
        error = error.cause
    }
    return error
}

export type JotaiCompatibilityErrorCode =
    | "VALDRES_JOTAI_LATE_GET"
    | "VALDRES_JOTAI_SIGNAL_UNSUPPORTED"
    | "VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED"
    | "VALDRES_JOTAI_ON_MOUNT_AFTER_FIRST_USE"
    | "VALDRES_JOTAI_LIFECYCLE_OUTSIDE_OPERATION"

/** Thrown where Jotai behavior cannot be reproduced faithfully on Valdres v1. */
export class JotaiCompatibilityError extends Error {
    readonly code: JotaiCompatibilityErrorCode

    constructor(code: JotaiCompatibilityErrorCode, message: string) {
        super(message)
        this.name = "JotaiCompatibilityError"
        this.code = code
    }
}
