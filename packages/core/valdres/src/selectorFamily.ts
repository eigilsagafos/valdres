import { stableStringify } from "./lib/stableStringify"
import { selector } from "./selector"
import type { SelectorFamily } from "./types/SelectorFamily"

export const selectorFamily = <Value, Key>(
    get: any,
    debugLabel?: string,
): SelectorFamily<Value, Key> => {
    const map = new Map()
    const selectorFamily = (key: Key) => {
        let keyStringified
        try {
            keyStringified = stableStringify(key)
        } catch (e) {
            console.log(`errro`, { key, debugLabel, e })
            throw e
        }
        if (map.has(keyStringified)) return map.get(keyStringified)
        const selectorDebugLabel = debugLabel
            ? debugLabel + "_" + keyStringified
            : undefined
        const newSelector = selector<Value, Key>(
            selectorArgs => get(key)(selectorArgs),
            selectorDebugLabel,
        )
        newSelector.family = selectorFamily
        map.set(keyStringified, newSelector)
        return newSelector
    }
    selectorFamily._map = map
    return selectorFamily
}
