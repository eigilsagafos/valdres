import { isPromiseLike } from "../utils/isPromiseLike"

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
        const obj = {}
        for (const [k, v] of x) {
            // Stringify will escape any nested quotes
            obj[typeof k === "string" ? k : stringify(k, opt)] = v
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

    return stableStringifyRecurse(x)
}
