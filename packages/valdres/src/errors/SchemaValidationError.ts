import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"

/**
 * Thrown when a value fails its atom/selector `schema` while schema validation
 * is enabled. The underlying validation error (e.g. a Zod `ZodError`) is kept on
 * `cause`, and the offending atom/selector is named in the message so a failure
 * is debuggable in an app with hundreds of atoms — rather than surfacing a raw
 * `ZodError` from deep inside `setAtom`/`initSelector` with no context.
 */
export class SchemaValidationError extends Error {
    state: Atom<any> | Selector<any>

    constructor(cause: unknown, state: Atom<any> | Selector<any>) {
        super()
        // Set name so logs, error reporters (Sentry, etc.), and `String(err)`
        // show "SchemaValidationError: …" instead of the default "Error: …".
        this.name = "SchemaValidationError"
        this.cause = cause
        this.state = state
    }

    public get message(): string {
        const name = this.state?.name ?? "anonymous atom/selector"
        const detail =
            this.cause instanceof Error
                ? this.cause.message
                : String(this.cause)
        return `Schema validation failed for '${name}': ${detail}`
    }
}
