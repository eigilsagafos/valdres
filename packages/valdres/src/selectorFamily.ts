import { equal } from "./lib/equal"
import { stringifyFamilyArgs } from "./lib/stringifyFamilyArgs"
import { selector } from "./selector"
import type { GetValue } from "./types/GetValue"
import type { SelectorFamily } from "./types/SelectorFamily"
import type { SelectorOptions } from "./types/SelectorOptions"

const createOptions = <Value extends any, Args extends [any, ...any[]]>(
    options: SelectorOptions<Value> = {},
    family: SelectorFamily<Value, Args>,
    familyArgs: Args,
    familyArgsStringified: string | boolean | number,
) => {
    if (options.name) {
        return {
            equal,
            ...options,
            name: options?.name + "_" + familyArgsStringified,
            family,
            familyArgs,
            familyArgsStringified,
        }
    } else {
        return { equal, ...options, family, familyArgs, familyArgsStringified }
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
        const argsStringified = stringifyFamilyArgs(args)
        if (map.has(argsStringified)) return map.get(argsStringified)
        const newSelector = selector<Value, Args>(
            selectorArgs => callback(...args)(selectorArgs),
            createOptions<Value, Args>(
                options,
                selectorFamily,
                args,
                argsStringified,
            ),
        )
        map.set(argsStringified, newSelector)
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
