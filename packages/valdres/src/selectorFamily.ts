import { equal } from "./lib/equal"
import { familyKey, type EncodedFamilyKey } from "./lib/familyKey"
import { nativeAsyncSelectorError } from "./lib/nativeAsyncSelectorError"
import type { GetValue } from "./types/GetValue"
import type { Selector, SelectorGetOptions } from "./types/Selector"
import type { SelectorFamily } from "./types/SelectorFamily"
import type { SelectorFamilyOptions } from "./types/SelectorFamilyOptions"
import type { SelectorOptions } from "./types/SelectorOptions"
import type { InternalSelectorFamily } from "./types/InternalSelectorFamily"

export const selectorFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    callback: (
        ...args: Args
    ) => (get: GetValue, options: SelectorGetOptions) => Value | Promise<Value>,
    options?: SelectorFamilyOptions<Value, Args>,
): SelectorFamily<Value, Args> => {
    const map = new Map<EncodedFamilyKey, Selector<Value, Args>>()
    const stringMap = new Map<string, Selector<Value, Args>>()
    const keyOf = options?.keyOf
    let selectorOptions: SelectorOptions<Value> | undefined
    if (options !== undefined) {
        const { keyOf: _, ...rest } = options
        selectorOptions = rest
    }
    const hasName = !!selectorOptions?.name

    const selectorFamily = (...args: Args) => {
        let rawStringKey: string | undefined
        if (
            keyOf === undefined &&
            args.length === 1 &&
            typeof args[0] === "string"
        ) {
            rawStringKey = args[0]
            const cached = stringMap.get(rawStringKey)
            if (cached !== undefined) return cached
        }

        const keyArgs = keyOf === undefined ? args : [keyOf(...args)]
        const key = familyKey(keyArgs)

        // Single Map.get + undefined check instead of has() + get()
        const cached = map.get(key)
        if (cached !== undefined) return cached

        // Call the user's factory once at cache-miss time and store the
        // inner getter directly. The previous implementation wrapped it in
        // a closure that re-invoked `callback(...args)` on every evaluation,
        // allocating a new inner getter per read.
        const displayedKey =
            keyArgs.length === 1 && typeof keyArgs[0] === "string"
                ? keyArgs[0]
                : key
        const get = callback(...args)
        // Keep native-async behavior aligned with selector(). Detection stays
        // on the cache-miss path so family cache hits pay no extra work.
        if (get.constructor?.name === "AsyncFunction") {
            throw nativeAsyncSelectorError("selectorFamily()")
        }
        const newSelector = {
            equal,
            ...selectorOptions,
            get,
            family: internalSelectorFamily,
            familyArgs: args,
            familyArgsStringified: key,
            name: hasName
                ? selectorOptions!.name + "_" + displayedKey!
                : undefined,
        }

        map.set(key, newSelector)
        if (rawStringKey !== undefined) stringMap.set(rawStringKey, newSelector)
        return newSelector
    }
    const internalSelectorFamily = selectorFamily as InternalSelectorFamily<
        Value,
        Args
    >
    internalSelectorFamily.__valdresSelectorFamilyMap = map
    internalSelectorFamily.release = (...args: Args) => {
        if (
            keyOf === undefined &&
            args.length === 1 &&
            typeof args[0] === "string"
        ) {
            stringMap.delete(args[0])
        }
        const keyArgs = keyOf === undefined ? args : [keyOf(...args)]
        return map.delete(familyKey(keyArgs))
    }
    // Exposed on the family object too (members carry them via ...options) so
    // a consumer can read a family's schema without materializing a member.
    internalSelectorFamily.schema = selectorOptions?.schema
    internalSelectorFamily.schemaValidation = selectorOptions?.schemaValidation
    // Define `name` explicitly. When named, expose the user's name. When unnamed,
    // override the intrinsic JS function name ("selectorFamily") with `undefined`
    // so an unnamed family mirrors an unnamed selector — consumers (devtools,
    // sync, persistence) can detect "unnamed" via `name === undefined` instead of
    // matching the literal string "selectorFamily", which breaks under
    // minification and wrongly flags a family a user legitimately named
    // "selectorFamily".
    Object.defineProperty(selectorFamily, "name", {
        value: hasName ? selectorOptions!.name : undefined,
        writable: false,
    })
    return internalSelectorFamily
}
