import { equal } from "./lib/equal"
import { stringifyFamilyArgs } from "./lib/stringifyFamilyArgs"
import { selector } from "./selector"
import type { GetValue } from "./types/GetValue"
import type { SelectorFamily } from "./types/SelectorFamily"
import type { SelectorOptions } from "./types/SelectorOptions"

const createOptions = <Value extends any, Args extends [any, ...any[]]>(
    options: SelectorOptions<Value> = {},
    family: SelectorFamily<Value, Args>,
    familyKey: Args,
    keyStringified: string | boolean | number,
) => {
    if (options.name) {
        return {
            equal,
            ...options,
            name: options?.name + "_" + keyStringified,
            family,
            familyKey,
        }
    } else {
        return { equal, ...options, family, familyKey }
    }
}

export const selectorFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    callback: (...args: Args) => (get: GetValue) => Value | Promise<Value>,
    options?: SelectorOptions<Value>,
): SelectorFamily<Value, Args> => {
    const map = new Map()
    const selectorFamily = (...args: Args) => {
        const keyStringified = stringifyFamilyArgs(args)
        if (map.has(keyStringified)) return map.get(keyStringified)
        const newSelector = selector<Value, Args>(
            selectorArgs => callback(...args)(selectorArgs),
            createOptions<Value, Args>(
                options,
                selectorFamily,
                args,
                keyStringified,
            ),
        )
        map.set(keyStringified, newSelector)
        return newSelector
    }
    selectorFamily.__valdresSelectorFamilyMap = map
    if (options?.name)
        Object.defineProperty(selectorFamily, "name", {
            value: options.name,
            writable: false,
        })
    return selectorFamily
}
