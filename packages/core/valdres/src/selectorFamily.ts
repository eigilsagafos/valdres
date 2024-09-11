import { stableStringify } from "./lib/stableStringify"
import { selector } from "./selector"

export const selectorFamily = <V, A>(get, debugLabel?: string) => {
    const map = new Map()
    const selectorFamily = (key: A) => {
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
        const newSelector = selector(
            selectorArgs => get(key)(selectorArgs),
            selectorDebugLabel
        )
        newSelector.family = selectorFamily
        map.set(keyStringified, newSelector)
        return newSelector
    }
    selectorFamily._map = map
    return selectorFamily
}
