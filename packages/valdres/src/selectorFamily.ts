import { equal } from "./lib/equal"
import { familyKey, type EncodedFamilyKey } from "./lib/familyKey"
import { nativeAsyncSelectorError } from "./lib/nativeAsyncSelectorError"
import { WeakValueMap } from "./lib/WeakValueMap"
import type { GetValue } from "./types/GetValue"
import type { Selector, SelectorGetOptions } from "./types/Selector"
import type { SelectorFamily } from "./types/SelectorFamily"
import type { SelectorFamilyOptions } from "./types/SelectorFamilyOptions"
import type { SelectorOptions } from "./types/SelectorOptions"
import type { InternalSelectorFamily } from "./types/InternalSelectorFamily"

/** Copy `arguments` into a real array. Measurably cheaper than
 * `Array.prototype.slice.call(arguments)` on JSC, and only the variadic
 * (multi-arg / object-arg) family paths reach it. */
const copyArguments = (source: IArguments): any[] => {
    const length = source.length
    const args = new Array(length)
    for (let index = 0; index < length; index++) args[index] = source[index]
    return args
}

export const selectorFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    callback: (
        ...args: Args
    ) => (get: GetValue, options: SelectorGetOptions) => Value | Promise<Value>,
    options?: SelectorFamilyOptions<Value, Args>,
): SelectorFamily<Value, Args> => {
    const map = new WeakValueMap<EncodedFamilyKey, Selector<Value, Args>>({
        autonomousCleanup: true,
    })
    const stringMap = new WeakValueMap<string, Selector<Value, Args>>({
        autonomousCleanup: true,
    })
    const keyOf = options?.keyOf
    let selectorOptions: SelectorOptions<Value> | undefined
    if (options !== undefined) {
        const { keyOf: _, ...rest } = options
        selectorOptions = rest
    }
    const hasName = !!selectorOptions?.name

    // Cold path: build the member and cache it. Kept out of the accessor below
    // so the cache hit stays a small, inlinable function — with this body still
    // inline, a hit measured ~17 ns instead of ~5 ns. Mirrors createAtomFamily.
    const build = (
        args: any[],
        key: EncodedFamilyKey,
        displayedKey: EncodedFamilyKey = key,
        rawStringKey?: string,
    ) => {
        // One construction guard for every entry point. The string accessor
        // reaches here having probed only `stringMap`, which is keyed on the
        // raw string rather than the encoded key, so it has not yet ruled out a
        // canonical entry; the other accessors probed `map` under this exact
        // key and repeat it here. Cold path either way — build() runs only on a
        // miss — and it keeps "never publish a second member for one key" true
        // at one place instead of four.
        const existing = map.get(key)
        if (existing !== undefined) return existing

        // Call the user's factory once at cache-miss time and store the
        // inner getter directly. The previous implementation wrapped it in
        // a closure that re-invoked `callback(...args)` on every evaluation,
        // allocating a new inner getter per read.
        const get = callback(...(args as Args))
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
            familyArgs: args as Args,
            familyArgsStringified: key,
            name: hasName
                ? selectorOptions!.name + "_" + displayedKey
                : undefined,
        }

        map.set(key, newSelector)
        if (rawStringKey !== undefined) stringMap.set(rawStringKey, newSelector)
        return newSelector
    }

    // Hot path is the cache hit. Declaring a single positional param and reading
    // only `arguments.length` (never indexing `arguments`) lets JSC skip
    // materializing the arguments object and skip the rest-parameter array
    // allocation that `(...args)` forces on every call. The key for a single
    // non-string primitive arg IS that primitive (see familyKey), so it indexes
    // `map` directly; a raw string indexes `stringMap`, whose whole purpose is
    // to answer that lookup without encoding one. So no cache hit calls
    // familyKey() or allocates a tagged string.
    function defaultSelectorFamily(a0?: any) {
        if (arguments.length === 1) {
            const t = typeof a0
            if (t === "string") {
                const cached = stringMap.get(a0)
                if (cached !== undefined) return cached
                const args = [a0]
                return build(args, familyKey(args), a0, a0)
            }
            // The reciprocal is only evaluated for zero, preserving -0 identity
            // without putting Object.is() on every numeric cache hit.
            if (t === "number" && (a0 !== 0 || 1 / a0 === Infinity)) {
                const cached = map.get(a0)
                if (cached !== undefined) return cached
                return build([a0], a0)
            }
            if (t === "boolean" || t === "bigint") {
                const cached = map.get(a0)
                if (cached !== undefined) return cached
                return build([a0], a0)
            }
        }
        // Variadic path: object/multi args need a stable stringified key, and
        // pay for it on every call — see the `keyOf` note in selectorFamily.mdx.
        // Its cache hit resolves here rather than in build() so a multi-arg
        // member still costs one call, as it did before build() was split out.
        // One and two args cover a single object arg and an (id, field) pair;
        // both build their array from the positional parameter, so only wider
        // calls touch `arguments`.
        const args =
            arguments.length === 1
                ? [a0]
                : arguments.length === 2
                  ? [a0, arguments[1]]
                  : copyArguments(arguments)
        const key = familyKey(args)
        const cached = map.get(key)
        if (cached !== undefined) return cached
        return build(args, key)
    }

    function keyedSelectorFamily(a0?: any) {
        const args =
            arguments.length === 1
                ? [a0]
                : arguments.length === 2
                  ? [a0, arguments[1]]
                  : copyArguments(arguments)
        const keyArgs = [keyOf!(...(args as Args))]
        const key = familyKey(keyArgs)
        const cached = map.get(key)
        if (cached !== undefined) return cached
        return build(
            args,
            key,
            typeof keyArgs[0] === "string" ? keyArgs[0] : key,
        )
    }

    const selectorFamily =
        keyOf === undefined ? defaultSelectorFamily : keyedSelectorFamily
    // The single-positional-param + `arguments` shape isn't structurally a
    // `(...args: Args)` signature, so the callable needs an unchecked assertion.
    const internalSelectorFamily =
        selectorFamily as unknown as InternalSelectorFamily<Value, Args>
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
