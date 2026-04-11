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

        const get = (selectorArgs: GetValue) => callback(...args)(selectorArgs)
        const newSelector = {
            equal,
            ...options,
            get,
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
    if (hasName)
        Object.defineProperty(selectorFamily, "name", {
            value: options!.name,
            writable: false,
        })
    return selectorFamily
}
