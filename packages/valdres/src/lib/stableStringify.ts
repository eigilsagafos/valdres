import { isPromiseLike } from "../utils/isPromiseLike"

/** Sentinel returned when the recursive stringify blows the stack — most
 *  commonly a cyclic reference graph. Two distinct cyclic objects collide
 *  to the same sentinel; if you need to distinguish them, give them
 *  distinguishing primitive fields outside the cycle. */
const CIRCULAR = "__CIRCULAR__"

const stableStringifyRecurse = (x: any, key?: string): string => {
    // A optimization to avoid the more expensive JSON.stringify() for simple strings
    // This may lose protection for u2028 and u2029, though.
    if (typeof x === "string" && !x.includes('"') && !x.includes("\\")) {
        return `"${x}"`
    }

    // Handle primitive types
    switch (typeof x) {
        case "undefined":
            return "" // JSON.stringify(undefined) returns undefined, but we always want to return a string
        case "boolean":
            return x ? "true" : "false"
        case "number":
        case "symbol":
            // case 'bigint': // BigInt is not supported in www
            return String(x)
        case "string":
            // Add surrounding quotes and escape internal quotes
            return JSON.stringify(x)
        case "function":
            return `__FUNCTION(${x.toString()})__`
    }

    if (x === null) {
        return "null"
    }
    // Fallback case for unknown types
    if (typeof x !== "object") {
        return JSON.stringify(x) ?? ""
    }

    // Deal with all promises as equivalent for now.
    if (isPromiseLike(x)) {
        return "__PROMISE__"
    }

    // Arrays handle recursive stringification
    if (Array.isArray(x)) {
        // $FlowFixMe[missing-local-annot]
        return `[${x.map((v, i) => stableStringifyRecurse(v, i.toString()))}]`
    }

    // If an object defines a toJSON() method, then use that to override the
    // serialization.  This matches the behavior of JSON.stringify().
    // Pass the key for compatibility.
    // Immutable.js collections define this method to allow us to serialize them.
    if (typeof x.toJSON === "function") {
        // flowlint-next-line unclear-type: off
        return stableStringifyRecurse(x.toJSON(key), key)
    }

    // For built-in Maps, sort the keys in a stable order instead of the
    // default insertion order.  Support non-string keys.
    if (x instanceof Map) {
        const obj: Record<string, unknown> = {}
        for (const [k, v] of x) {
            const objKey =
                typeof k === "string" ? k : stableStringifyRecurse(k)
            obj[objKey] = v
        }
        return stableStringifyRecurse(obj, key)
    }

    // For built-in Sets, sort the keys in a stable order instead of the
    // default insertion order.
    if (x instanceof Set) {
        return stableStringifyRecurse(
            // $FlowFixMe[missing-local-annot]
            Array.from(x).sort((a, b) =>
                stableStringifyRecurse(a).localeCompare(
                    stableStringifyRecurse(b),
                ),
            ),
            key,
        )
    }

    // Anything else that is iterable serialize as an Array.
    if (
        Symbol !== undefined &&
        x[Symbol.iterator] != null &&
        typeof x[Symbol.iterator] === "function"
    ) {
        // flowlint-next-line unclear-type: off
        return stableStringifyRecurse(Array.from(x), key)
    }

    // For all other Objects, sort the keys in a stable order.
    return `{${Object.keys(x)
        .filter(k => x[k] !== undefined)
        .sort()
        // stringify the key to add quotes and escape any nested slashes or quotes.
        .map(
            k =>
                `${stableStringifyRecurse(k)}:${stableStringifyRecurse(
                    x[k],
                    k,
                )}`,
        )
        .join(",")}}`
}

export const stableStringify = (x: any): string | number | boolean => {
    if (
        typeof x === "string" ||
        typeof x === "boolean" ||
        typeof x === "number"
    )
        return x

    try {
        return stableStringifyRecurse(x)
    } catch (error) {
        // Mirrors the cycle-handling in `equal()`: stack-overflow from a
        // cyclic reference graph blows up the recursion. Catch and fall
        // back to a sentinel so callers (family keying, index term keys)
        // don't crash. Engines surface this differently:
        //   chrome/safari/edge: RangeError "Maximum call stack size exceeded"
        //   firefox:            InternalError "too much recursion"
        // We match by constructor / `.name` so we don't accidentally
        // swallow user-thrown errors whose message happens to contain
        // "stack" or "recursion" (e.g. a toJSON handler that throws
        // `new Error("stack frame parsing failed")`).
        if (isOverflowLike(error)) return CIRCULAR
        throw error
    }
}

/** True for engine-thrown stack-overflow errors. Structured check
 *  (constructor + `.name`) avoids false positives from user errors
 *  whose `.message` happens to contain "stack" or "recursion". */
const isOverflowLike = (error: unknown): boolean => {
    if (error instanceof RangeError) return true
    if (error instanceof Error && error.name === "InternalError") return true
    return false
}
