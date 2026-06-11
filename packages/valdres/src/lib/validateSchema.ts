import { SchemaValidationError } from "../errors/SchemaValidationError"
import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { StandardSchemaV1 } from "../types/StandardSchemaV1"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"

// Render Standard Schema issues into a single readable message (a vendor like
// Valibot/ArkType reports `issues` rather than throwing a rich error object).
const standardIssuesError = (
    issues: ReadonlyArray<StandardSchemaV1.Issue>,
): Error => {
    const message = issues
        .map(issue => {
            const path = issue.path
                ?.map(seg =>
                    typeof seg === "object" && seg !== null
                        ? String(seg.key)
                        : String(seg),
                )
                .join(".")
            return path ? `${path}: ${issue.message}` : issue.message
        })
        .join("; ")
    return new Error(message)
}

/**
 * Validate `value` against the atom/selector's `schema` when validation is
 * enabled, returning the value unchanged.
 *
 * Validate-only: the schema runs purely for its rejecting side effect; its
 * (possibly transformed/coerced) output is intentionally discarded so the
 * stored value is identical whether validation is on or off. This keeps schema
 * validation a pure correctness aid with no dev/prod behavioral divergence —
 * a transform like `z.string().trim()` validates but never mutates state.
 *
 * Enablement is per-state-then-store: an atom/selector's own `schemaValidation`
 * (if set) wins over the store's; both default off.
 *
 * Promises are skipped — async values are validated once they resolve (see the
 * async paths in setAtom/initAtom/initSelector), never the in-flight promise.
 *
 * Two schema shapes are accepted. A `parse(value)` method is preferred (it
 * throws a library-native error — e.g. Zod's `ZodError` — which is kept on
 * `cause`); otherwise a Standard Schema (`~standard`) is used (Valibot,
 * ArkType, …). Either way the failure is wrapped in a SchemaValidationError
 * naming the offending atom/selector. Asynchronous validation (an async
 * `~standard.validate`) is rejected — validation runs on the synchronous path.
 */
export const validateSchema = <V>(
    state: Atom<any> | Selector<any>,
    value: V,
    data: StoreData,
): V => {
    const enabled = state.schemaValidation ?? data.schemaValidation ?? false
    const schema = state.schema
    if (enabled && schema && !isPromiseLike(value)) {
        if ("parse" in schema) {
            try {
                schema.parse(value)
            } catch (cause) {
                throw new SchemaValidationError(cause, state)
            }
        } else {
            const result = schema["~standard"].validate(value)
            if (isPromiseLike(result)) {
                throw new SchemaValidationError(
                    new Error(
                        "Asynchronous schema validation is not supported; " +
                            "use a synchronous schema.",
                    ),
                    state,
                )
            }
            if (result.issues) {
                throw new SchemaValidationError(
                    standardIssuesError(result.issues),
                    state,
                )
            }
        }
    }
    return value
}
