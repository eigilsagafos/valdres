const unsupported = (description: string): never => {
    throw new TypeError(
        `valdres: Unsupported family key value (${description}). ` +
            "Pass a deterministic options.keyOf function for this argument type.",
    )
}

const enter = (value: object, active: WeakSet<object>) => {
    if (active.has(value)) {
        throw new TypeError(
            "valdres: Cyclic family key values are not supported. " +
                "Pass a deterministic options.keyOf function for cyclic arguments.",
        )
    }
    active.add(value)
}

const rejectSymbolProperties = (value: object) => {
    if (Object.getOwnPropertySymbols(value).length > 0) {
        unsupported("symbol-keyed property")
    }
}

const rejectOwnProperties = (value: object, description: string) => {
    if (Object.getOwnPropertyNames(value).length > 0) unsupported(description)
    rejectSymbolProperties(value)
}

const encodeNumber = (value: number) => {
    if (Number.isNaN(value)) return "nNaN;"
    if (value === Infinity) return "nInfinity;"
    if (value === -Infinity) return "n-Infinity;"
    if (Object.is(value, -0)) return "n-0;"
    return `n${value};`
}

/**
 * Encode one supported family-key value into an injective, self-delimiting
 * string. Type tags keep unlike JS values apart; container lengths and
 * length-prefixed strings make nested values unambiguous without escaping.
 */
const encodeValue = (value: unknown, active: WeakSet<object>): string => {
    switch (typeof value) {
        case "undefined":
            return "u;"
        case "boolean":
            return value ? "b1;" : "b0;"
        case "number":
            return encodeNumber(value)
        case "bigint":
            return `i${value};`
        case "string":
            return `s${value.length}:${value}`
        case "symbol":
            return unsupported("symbol")
        case "function":
            return unsupported("function")
    }

    if (value === null) return "z;"
    // The typeof switch above is exhaustive, but both TypeScript compilers in
    // this repository currently retain `undefined` in the fallthrough type.
    // Keep the runtime guard explicit and make the object-only code below
    // unambiguous to declaration emit.
    if (typeof value !== "object") return unsupported(typeof value)

    // Promise identity/result is neither structural nor synchronously
    // knowable. Do not duck-type by reading `.then`: that could invoke a user
    // getter, while the rest of this codec deliberately reads data descriptors.
    if (value instanceof Promise) return unsupported("Promise")

    if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) {
            return unsupported("Array subclass")
        }
        enter(value, active)
        try {
            rejectSymbolProperties(value)
            const keys = Object.getOwnPropertyNames(value).filter(
                key => key !== "length",
            )
            for (const key of keys) {
                const index = Number(key)
                if (
                    !Number.isInteger(index) ||
                    index < 0 ||
                    index >= value.length ||
                    String(index) !== key
                ) {
                    return unsupported("Array with non-index property")
                }
            }

            keys.sort((a, b) => Number(a) - Number(b))
            let encoded = `r${value.length}:${keys.length}:`
            for (const key of keys) {
                const descriptor = Object.getOwnPropertyDescriptor(value, key)!
                if (!("value" in descriptor)) {
                    return unsupported("Array accessor property")
                }
                encoded += `j${key};${encodeValue(descriptor.value, active)}`
            }
            return encoded
        } finally {
            active.delete(value)
        }
    }

    if (value instanceof Date) {
        if (Object.getPrototypeOf(value) !== Date.prototype) {
            return unsupported("Date subclass")
        }
        rejectOwnProperties(value, "Date with custom properties")
        return `d${Date.prototype.getTime.call(value)};`
    }

    if (value instanceof Map) {
        if (Object.getPrototypeOf(value) !== Map.prototype) {
            return unsupported("Map subclass")
        }
        enter(value, active)
        try {
            rejectOwnProperties(value, "Map with custom properties")
            const entries: string[] = []
            for (const [entryKey, entryValue] of Map.prototype.entries.call(
                value,
            )) {
                entries.push(
                    encodeValue(entryKey, active) +
                        encodeValue(entryValue, active),
                )
            }
            entries.sort()
            return `m${entries.length}:${entries.join("")}`
        } finally {
            active.delete(value)
        }
    }

    if (value instanceof Set) {
        if (Object.getPrototypeOf(value) !== Set.prototype) {
            return unsupported("Set subclass")
        }
        enter(value, active)
        try {
            rejectOwnProperties(value, "Set with custom properties")
            const entries: string[] = []
            for (const entry of Set.prototype.values.call(value)) {
                entries.push(encodeValue(entry, active))
            }
            entries.sort()
            return `e${entries.length}:${entries.join("")}`
        } finally {
            active.delete(value)
        }
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
        return unsupported("non-plain object or class instance")
    }

    enter(value, active)
    try {
        rejectSymbolProperties(value)
        const keys = Object.keys(value).sort()
        if (Object.getOwnPropertyNames(value).length !== keys.length) {
            return unsupported("object with non-enumerable property")
        }
        let encoded = `${prototype === null ? "q" : "o"}${keys.length}:`
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key)!
            if (!("value" in descriptor)) {
                return unsupported("object accessor property")
            }
            encoded += `k${key.length}:${key}`
            encoded += encodeValue(descriptor.value, active)
        }
        return encoded
    } finally {
        active.delete(value)
    }
}

/** Encode a complete family call. The leading argument count distinguishes a
 * single Array argument from multiple positional arguments. */
export const stringifyFamilyArgs = (args: readonly unknown[]): string => {
    const active = new WeakSet<object>()
    let encoded = `a${args.length}:`
    for (const arg of args) encoded += encodeValue(arg, active)
    return encoded
}
