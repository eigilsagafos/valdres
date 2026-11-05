const WRAPPERS = new Set([
    "VALDRES_SELECTOR_GETTER_ERROR",
    "VALDRES_SELECTOR_DEPENDENCY_ERROR",
])

/**
 * Valdres wraps selector failures; Recoil hands error boundaries, `get` and
 * loadables the value the getter threw. Follow the documented wrapper codes
 * back to it.
 */
export const unwrapError = (error: unknown): unknown => {
    while (
        error instanceof Error &&
        WRAPPERS.has((error as { code?: string }).code ?? "")
    )
        error = error.cause
    return error
}
