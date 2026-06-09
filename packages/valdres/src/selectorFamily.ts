import { equal } from "./lib/equal"
import { familyKey } from "./lib/familyKey"
import type { GetValue } from "./types/GetValue"
import type { SelectorFamily } from "./types/SelectorFamily"
import type { SelectorOptions } from "./types/SelectorOptions"

export const selectorFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    callback: (...args: Args) => (get: GetValue) => Value | Promise<Value>,
    options?: SelectorOptions<Value>,
): SelectorFamily<Value, Args> => {
    const map = new Map()
    const hasName = !!options?.name

    const selectorFamily = (...args: Args) => {
        const key = familyKey(args)

        // Single Map.get + undefined check instead of has() + get()
        const cached = map.get(key)
        if (cached !== undefined) return cached

        // Call the user's factory once at cache-miss time and store the
        // inner getter directly. The previous implementation wrapped it in
        // a closure that re-invoked `callback(...args)` on every evaluation,
        // allocating a new inner getter per read.
        const newSelector = {
            equal,
            ...options,
            get: callback(...args),
            family: selectorFamily,
            familyArgs: args,
            familyArgsStringified: key,
            name: hasName
                ? options!.name + "_" + key
                : undefined,
        }

        map.set(key, newSelector)
        return newSelector
    }
    selectorFamily.__valdresSelectorFamilyMap = map
    selectorFamily.release = (...args: Args) => map.delete(familyKey(args))
    // Exposed on the family object too (members carry them via ...options) so
    // a consumer can read a family's schema without materializing a member.
    selectorFamily.schema = options?.schema
    selectorFamily.schemaValidation = options?.schemaValidation
    if (hasName)
        Object.defineProperty(selectorFamily, "name", {
            value: options!.name,
            writable: false,
        })
    return selectorFamily
}
