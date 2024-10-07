import { selector } from "./selector"
import { stableStringify } from "./lib/stableStringify"
import type { SelectorFamily } from "./types/SelectorFamily"
import type { SelectorOptions } from "./types/SelectorOptions"

const createOptions = (
    options: SelectorOptions,
    key: string | boolean | number,
) => {
    if (options.label) {
        return {
            ...options,
            label: options?.label + "_" + key,
        }
    } else {
        return options
    }
}

export const selectorFamily = <Value, Key>(
    get: any,
    options?: SelectorOptions,
): SelectorFamily<Value, Key> => {
    const map = new Map()
    const selectorFamily = (key: Key) => {
        const keyStringified = stableStringify(key)
        if (map.has(keyStringified)) return map.get(keyStringified)
        const newSelector = selector<Value, Key>(
            selectorArgs => get(key)(selectorArgs),
            options ? createOptions(options, keyStringified) : undefined,
        )
        newSelector.family = selectorFamily
        map.set(keyStringified, newSelector)
        return newSelector
    }
    selectorFamily.__valdresSelectorFamilyMap = map
    if (options?.label) selectorFamily.label = options.label
    return selectorFamily
}
