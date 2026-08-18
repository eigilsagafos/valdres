import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import {
    brandedErrorHasInstance,
    errorBrand,
    markError,
} from "./lib/errorBrand"

const SCHEMA_VALIDATION_ERROR = errorBrand("SchemaValidationError")

/**
 * Thrown when a value fails its atom/selector `schema` while schema validation
 * is enabled. The underlying validation error (e.g. a Zod `ZodError`) is kept on
 * `cause`, and the offending atom/selector is named in the message so a failure
 * is debuggable in an app with hundreds of atoms — rather than surfacing a raw
 * `ZodError` from deep inside `setAtom`/`initSelector` with no context.
 */
export class SchemaValidationError extends Error {
    state: Atom<any> | Selector<any>

    /** Preserve instanceof across adopted same-version package copies. */
    static [Symbol.hasInstance](value: unknown): boolean {
        return brandedErrorHasInstance(
            this,
            SchemaValidationError,
            value,
            SCHEMA_VALIDATION_ERROR,
        )
    }

    constructor(cause: unknown, state: Atom<any> | Selector<any>) {
        super()
        markError(this, SCHEMA_VALIDATION_ERROR)
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
