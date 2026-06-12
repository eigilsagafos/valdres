import { SchemaValidationError } from "../errors/SchemaValidationError"
import type { Atom } from "../types/Atom"
import { IS_PROD } from "./IS_PROD"

/** The bidirectional (wire-codable) schema surface `dehydrate`/`hydrate` use:
 *  zod 4's `safeEncode`/`safeDecode` (every zod 4 schema carries them; codecs
 *  created with `z.codec(wire, runtime, …)` make them an actual conversion,
 *  plain schemas make them a validating identity). Classic `parse(value)`
 *  validators and Standard-Schema-only libraries (Valibot, ArkType) don't have
 *  them, so their atoms transfer raw values exactly as before. */
type BidirectionalSchema = {
    safeEncode: (value: unknown) => {
        success: boolean
        data?: unknown
        error?: unknown
    }
    safeDecode: (value: unknown) => {
        success: boolean
        data?: unknown
        error?: unknown
    }
}

const wireSchemaOf = (state: Atom<any>): BidirectionalSchema | undefined => {
    const schema = state.schema as Partial<BidirectionalSchema> | undefined
    if (
        schema &&
        typeof schema.safeEncode === "function" &&
        typeof schema.safeDecode === "function"
    ) {
        return schema as BidirectionalSchema
    }
    return undefined
}

/** Schemas already warned about being one-way (per schema, not per atom, so a
 *  family doesn't warn once per member). */
const warnedUnidirectional = new WeakSet<object>()

/** Encode an atom's runtime value for the wire via its schema, when the schema
 *  is bidirectional (zod 4 `safeEncode`/`safeDecode`).
 *
 *  - No schema / not bidirectional → the raw value, `encoded: false`.
 *  - Encode succeeds → the wire value (e.g. BigInt → string), `encoded: true`;
 *    the payload entry is marked so `hydrate` knows to decode it.
 *  - One-way transform schema (zod throws `ZodEncodeError`) → the raw value
 *    with a once-per-schema dev warning: such a schema can't speak wire, which
 *    is the pre-codec behavior, kept for compatibility.
 *  - Encode reports the value INVALID → throw `SchemaValidationError` naming
 *    the atom. The store holds a value that violates its own schema (possible
 *    when validation is off); emitting it would produce a payload the client
 *    cannot decode — fail on the server, where the bug is. */
export const encodeWireValue = (
    state: Atom<any>,
    value: unknown,
): { value: unknown; encoded: boolean } => {
    const schema = wireSchemaOf(state)
    if (!schema) return { value, encoded: false }
    let result
    try {
        result = schema.safeEncode(value)
    } catch (error) {
        // zod throws ZodEncodeError (rather than reporting a result) when the
        // schema contains a unidirectional transform — there is no encode
        // direction at all, so the atom's value simply isn't wire-codable.
        if ((error as Error | null)?.name === "ZodEncodeError") {
            if (!IS_PROD && !warnedUnidirectional.has(schema)) {
                warnedUnidirectional.add(schema)
                console.warn(
                    `valdres: dehydrate is emitting '${state.name ?? "anonymous atom"}' raw — its schema cannot encode (${error instanceof Error ? error.message : String(error)}). Use a bidirectional codec (z.codec) for wire-transformed values.`,
                )
            }
            return { value, encoded: false }
        }
        // Any other throw is a user encode function failing on this value —
        // a validation failure, not a missing direction.
        throw new SchemaValidationError(error, state)
    }
    if (result.success) return { value: result.data, encoded: true }
    throw new SchemaValidationError(result.error, state)
}

/** Decode a wire-encoded payload entry back to the runtime value via the
 *  atom's schema. Only called for entries `dehydrate` marked as encoded; a
 *  failure (tampered/skewed wire data, or a registered schema that can no
 *  longer decode) throws `SchemaValidationError` naming the atom, which
 *  `hydrate` routes through its `invalid` policy. */
export const decodeWireValue = (state: Atom<any>, wireValue: unknown): unknown => {
    const schema = wireSchemaOf(state)
    if (!schema) {
        throw new SchemaValidationError(
            new Error(
                "the payload entry is wire-encoded, but the registered atom's schema is not bidirectional (no safeDecode) — was it dehydrated with a different schema?",
            ),
            state,
        )
    }
    // A user decode function may throw outright (e.g. BigInt("garbage")
    // throws a SyntaxError) instead of reporting issues — zod propagates such
    // throws through safeDecode. Either way it's a decode failure of this
    // entry: wrap it so hydrate's `invalid` policy applies uniformly.
    let result
    try {
        result = schema.safeDecode(wireValue)
    } catch (error) {
        throw new SchemaValidationError(error, state)
    }
    if (!result.success) throw new SchemaValidationError(result.error, state)
    return result.data
}
