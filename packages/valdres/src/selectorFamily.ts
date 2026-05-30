import { createSelector } from "./lib/selectorShape"
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
        // inner getter directly — no per-read wrapper closure.
        const memberName = hasName
            ? options!.name + "_" + key
            : undefined
        const newSelector = createSelector<Value, Args>(
            callback(...args) as any,
            options,
            memberName,
            selectorFamily as any,
            args,
            key,
        )

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
