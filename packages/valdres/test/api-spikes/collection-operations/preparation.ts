import type {
    CollectionId,
    EffectiveRowDelta,
    RowId,
    ValueToken,
} from "../../v1-model/index"
import type { CheckpointRow, IndexProjector, PreparedIndexDelta } from "./types"

/**
 * Test-side stand-in for guarded collection/index preflight. Production must
 * prepare these keys before its source commit; this helper cannot prove abort.
 */
export function prepareIndexDelta(
    delta: EffectiveRowDelta,
    project: IndexProjector,
): PreparedIndexDelta {
    return Object.freeze({
        ...delta,
        ...(delta.before.kind === "present"
            ? {
                  beforeKey: runIndexProjector(
                      project,
                      delta.row,
                      delta.before.value,
                  ),
              }
            : {}),
        ...(delta.after.kind === "present"
            ? {
                  afterKey: runIndexProjector(
                      project,
                      delta.row,
                      delta.after.value,
                  ),
              }
            : {}),
    })
}

export function runIndexProjector(
    project: IndexProjector,
    row: RowId,
    value: ValueToken,
): string {
    let candidate: unknown
    try {
        candidate = project(row, value)
    } catch (error) {
        if (isThenable(error)) {
            containThenable(error)
            throw new InvalidIndexKeyError()
        }
        throw error
    }
    return assertPreparedIndexKey(candidate)
}

/** Runtime admission shared by scans, prepared commits, and artifacts. */
export function assertPreparedIndexKey(candidate: unknown): string {
    if (typeof candidate === "string") return candidate
    if (isThenable(candidate)) containThenable(candidate)
    throw new InvalidIndexKeyError()
}

export class InvalidIndexKeyError extends Error {
    readonly code = "INVALID_INDEX_KEY"

    constructor() {
        super("INVALID_INDEX_KEY: this spike requires a primitive string key")
        this.name = "InvalidIndexKeyError"
    }
}

export function logicalCheckpointFor(
    collection: CollectionId,
    rows: readonly Pick<CheckpointRow, "row" | "value">[],
): string {
    return checksum(
        JSON.stringify([
            collection,
            rows.map(entry => [entry.row, encodeValueToken(entry.value)]),
        ]),
    )
}

export function encodeValueToken(token: ValueToken): string {
    switch (token.kind) {
        case "undefined":
            return "undefined"
        case "null":
            return "null"
        case "boolean":
            return `boolean:${token.value ? "1" : "0"}`
        case "number":
            if (Number.isNaN(token.value)) return "number:NaN"
            if (Object.is(token.value, -0)) return "number:-0"
            if (token.value === Number.POSITIVE_INFINITY)
                return "number:+Infinity"
            if (token.value === Number.NEGATIVE_INFINITY)
                return "number:-Infinity"
            return `number:${String(token.value)}`
        case "string":
            return `string:${JSON.stringify(token.value)}`
        case "bigint":
            return `bigint:${token.value.toString(10)}`
        case "identity":
            return `identity:${token.identityKind}:${JSON.stringify(token.id)}`
    }
}

export function checksum(input: string): string {
    let hash = 0x811c9dc5
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
    }
    return (hash >>> 0).toString(16).padStart(8, "0")
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
    if (
        value === null ||
        (typeof value !== "object" && typeof value !== "function")
    ) {
        return false
    }
    try {
        return typeof (value as { then?: unknown }).then === "function"
    } catch {
        return true
    }
}

function containThenable(thenable: PromiseLike<unknown>): void {
    try {
        thenable.then(undefined, () => undefined)
    } catch {
        // Invalid synchronous thenables are still normalized to one key error.
    }
}
