import equal from "fast-deep-equal/es6"
import { selector } from "./selector"
import { stableStringify } from "./lib/stableStringify"
import type { SelectorFamily } from "./types/SelectorFamily"
import type { SelectorOptions } from "./types/SelectorOptions"
import type { GetValue } from "./types/GetValue"

const createOptions = <K, V>(
    options: SelectorOptions<V> = {},
    family: SelectorFamily<K, V>,
    familyKey: K,
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

export const selectorFamily = <Key, Value>(
    get: (key: Key) => (get: GetValue) => Value,
    options?: SelectorOptions<Value>,
): SelectorFamily<Key, Value> => {
    const map = new Map()
    const selectorFamily = (key: Key) => {
        const keyStringified = stableStringify(key)
        if (map.has(keyStringified)) return map.get(keyStringified)
        const newSelector = selector<Value, Key>(
            selectorArgs => get(key)(selectorArgs),
            createOptions<Key, Value>(
                options,
                selectorFamily,
                key,
                keyStringified,
            ),
        )
        map.set(keyStringified, newSelector)
        return newSelector
    }
    selectorFamily.__valdresSelectorFamilyMap = map
    if (options?.name) selectorFamily.name = options.name
    return selectorFamily
}
