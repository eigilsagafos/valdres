import type { StandardSchemaV1 } from "./StandardSchemaV1"

/**
 * A schema usable for runtime validation of an atom/selector value.
 *
 * Accepts either:
 *  - a **Standard Schema** (https://standard-schema.dev) via its `~standard`
 *    property — Zod 3.24+/4, Valibot 1+, ArkType 2+, etc.; or
 *  - a classic **parser** with a `parse(value)` method (an older Zod schema or
 *    any custom validator).
 *
 * Validation is **validate-only**: the value is checked but the original input
 * is stored unchanged. With a plain validator (`z.string()`) input and output
 * coincide, so the inferred atom type matches the stored value. But a
 * transforming/coercing schema (`z.coerce.number()`, `z.string().trim()`,
 * `z.string().default(...)`) validates without altering stored state — and its
 * inferred type follows the schema's *output* while the stored value stays the
 * *input*. Avoid transform/coerce/default schemas here: the type would not
 * describe what's actually stored.
 */
export type Schema<V = unknown> =
    | StandardSchemaV1<V>
    | { parse: (value: unknown) => V }
