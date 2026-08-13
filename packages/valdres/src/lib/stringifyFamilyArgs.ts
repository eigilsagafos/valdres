const unsupported = (description: string): never => {
    throw new TypeError(
        `valdres: unsupported family key value (${description}). ` +
            "Pass a deterministic options.keyOf function for this argument type.",
    )
}

const enter = (value: object, active: WeakSet<object>) => {
    if (active.has(value)) {
        throw new TypeError(
            "valdres: cyclic family key values are not supported. " +
                "Pass a deterministic options.keyOf function for cyclic arguments.",
        )
    }
    active.add(value)
}

const rejectOwnProperties = (value: object, description: string) => {
    if (Reflect.ownKeys(value).length > 0) unsupported(description)
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

    if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) {
            return unsupported("Array subclass")
        }
        enter(value, active)
        try {
            const keys: string[] = []
            for (const ownKey of Reflect.ownKeys(value)) {
                if (typeof ownKey === "symbol") {
                    return unsupported("symbol-keyed property")
                }
                if (ownKey === "length") continue
                const key = ownKey
                const index = Number(key)
                if (
                    !Number.isInteger(index) ||
                    index < 0 ||
                    index >= value.length ||
                    String(index) !== key
                ) {
                    return unsupported("Array with non-index property")
                }
                keys.push(key)
            }

            keys.sort((a, b) => Number(a) - Number(b))
            let encoded = `r${value.length}:${keys.length}:`
            for (const key of keys) {
                const descriptor = Object.getOwnPropertyDescriptor(value, key)
                if (descriptor === undefined || !("value" in descriptor)) {
                    return unsupported("Array accessor property")
                }
                encoded += `j${key};${encodeValue(descriptor.value, active)}`
            }
            return encoded
        } finally {
            active.delete(value)
        }
    }

    // Route exact built-ins by prototype instead of running every object
    // through four instanceof checks. Plain-object family keys are a common
    // lookup path, and this keeps their validation overhead proportional to
    // their own properties. Cross-realm built-ins and subclasses deliberately
    // fall through to the unsupported case below.
    const prototype = Object.getPrototypeOf(value)

    if (prototype === Object.prototype || prototype === null) {
        enter(value, active)
        try {
            const ownKeys = Reflect.ownKeys(value)
            for (const key of ownKeys) {
                if (typeof key === "symbol") {
                    return unsupported("symbol-keyed property")
                }
            }
            const keys = ownKeys as string[]
            keys.sort()
            let encoded = `${prototype === null ? "q" : "o"}${keys.length}:`
            for (const key of keys) {
                const descriptor = Object.getOwnPropertyDescriptor(value, key)
                if (descriptor === undefined || !descriptor.enumerable) {
                    return unsupported("object with non-enumerable property")
                }
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

    if (prototype === Date.prototype) {
        rejectOwnProperties(value, "Date with custom properties")
        try {
            return `d${Date.prototype.getTime.call(value)};`
        } catch {
            return unsupported("non-Date object with Date prototype")
        }
    }

    if (prototype === Map.prototype) {
        enter(value, active)
        try {
            rejectOwnProperties(value, "Map with custom properties")
            const entries: string[] = []
            let iterator: IterableIterator<[unknown, unknown]>
            try {
                iterator = Map.prototype.entries.call(value)
            } catch {
                return unsupported("non-Map object with Map prototype")
            }
            for (const [entryKey, entryValue] of iterator) {
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

    if (prototype === Set.prototype) {
        enter(value, active)
        try {
            rejectOwnProperties(value, "Set with custom properties")
            const entries: string[] = []
            let iterator: IterableIterator<unknown>
            try {
                iterator = Set.prototype.values.call(value)
            } catch {
                return unsupported("non-Set object with Set prototype")
            }
            for (const entry of iterator) {
                entries.push(encodeValue(entry, active))
            }
            entries.sort()
            return `e${entries.length}:${entries.join("")}`
        } finally {
            active.delete(value)
        }
    }

    // Promise identity/result is neither structural nor synchronously
    // knowable. Do not duck-type by reading `.then`: that could invoke a user
    // getter, while the rest of this codec deliberately reads data descriptors.
    if (prototype === Promise.prototype) return unsupported("Promise")

    return unsupported("non-plain object or class instance")
}

/** Encode a complete family call. The leading argument count distinguishes a
 * single Array argument from multiple positional arguments. */
export const stringifyFamilyArgs = (args: readonly unknown[]): string => {
    const active = new WeakSet<object>()
    let encoded = `a${args.length}:`
    for (const arg of args) encoded += encodeValue(arg, active)
    return encoded
}
