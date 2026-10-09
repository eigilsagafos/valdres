/**
 * Recoil's family parameter serialization, so parameters that are the same
 * family member in Recoil are the same member here.
 *
 * Ported from Recoil 0.7.7 `Recoil_stableStringify` (MIT, Copyright (c) Meta
 * Platforms, Inc. and affiliates): strings are JSON-quoted, `undefined` is
 * empty, object and Map keys are sorted, Sets are sorted, other iterables are
 * arrays, `toJSON` overrides, and Promises are all equal. Functions throw
 * unless `allowFunctions` is set; BigInt throws like `JSON.stringify`.
 */
import { isThenable } from "./isThenable"

interface Options {
    readonly allowFunctions?: boolean
}

const stringify = (x: any, options: Options, key?: string): string => {
    if (typeof x === "string" && !x.includes('"') && !x.includes("\\"))
        return `"${x}"`
    switch (typeof x) {
        case "undefined":
            return ""
        case "boolean":
            return x ? "true" : "false"
        case "number":
        case "symbol":
            return String(x)
        case "string":
            return JSON.stringify(x)
        case "function":
            if (options.allowFunctions !== true)
                throw new Error(
                    "Attempt to serialize function in a Recoil cache key",
                )
            return `__FUNCTION(${x.name})__`
    }
    if (x === null) return "null"
    if (typeof x !== "object") return JSON.stringify(x) ?? ""
    if (isThenable(x)) return "__PROMISE__"
    if (Array.isArray(x))
        return `[${x.map((v, i) => stringify(v, options, i.toString()))}]`
    if (typeof x.toJSON === "function")
        return stringify(x.toJSON(key), options, key)
    if (x instanceof Map) {
        const object: Record<string, unknown> = {}
        for (const [k, v] of x)
            object[typeof k === "string" ? k : stringify(k, options)] = v
        return stringify(object, options, key)
    }
    if (x instanceof Set)
        return stringify(
            Array.from(x).sort((a, b) =>
                stringify(a, options).localeCompare(stringify(b, options)),
            ),
            options,
            key,
        )
    if (typeof x[Symbol.iterator] === "function")
        return stringify(Array.from(x), options, key)
    return `{${Object.keys(x)
        .filter(k => x[k] !== undefined)
        .sort()
        .map(k => `${stringify(k, options)}:${stringify(x[k], options, k)}`)
        .join(",")}}`
}

export const stableStringify = (x: unknown, options: Options = {}): string =>
    stringify(x, options)
