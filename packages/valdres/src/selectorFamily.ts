import { equal } from "./lib/equal"
import { stringifyFamilyArgs } from "./lib/stringifyFamilyArgs"
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
        const argsStringified = stringifyFamilyArgs(args)
        if (map.has(argsStringified)) return map.get(argsStringified)

        // Build selector in a single allocation — no intermediate objects
        const get = (selectorArgs: GetValue) => callback(...args)(selectorArgs)
        const newSelector = {
            equal,
            ...options,
            get,
            family: selectorFamily,
            familyArgs: args,
            familyArgsStringified: argsStringified,
            name: hasName
                ? options!.name + "_" + argsStringified
                : undefined,
        }

        map.set(argsStringified, newSelector)
        return newSelector
    }
    selectorFamily.__valdresSelectorFamilyMap = map
    selectorFamily.release = (...args: Args) =>
        map.delete(stringifyFamilyArgs(args))
    if (hasName)
        Object.defineProperty(selectorFamily, "name", {
            value: options!.name,
            writable: false,
        })
    return selectorFamily
}
