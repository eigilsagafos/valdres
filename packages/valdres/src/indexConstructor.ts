import { stableStringify } from "./lib/stableStringify"
import { selector } from "./selector"
import type { AtomFamily } from "./types/AtomFamily"
import type { FamilyKey } from "./types/FamilyKey"
import type { Selector } from "./types/Selector"

export const index = <T, K extends FamilyKey = FamilyKey, V = unknown>(
    family: AtomFamily<K, V>,
    callback: (value: V, term: T) => boolean,
): ((term: T) => Selector<T[]>) => {
    const map = new Map()
    return (term: T) => {
        const termKey = stableStringify(term)
        if (map.has(termKey)) return map.get(termKey)
        const itemSelectorMap = new Map()
        const selectorMapIndex = selector(get => {
            const ids = get(family)
            ids.forEach(id => {
                if (itemSelectorMap.has(id)) return
                itemSelectorMap.set(
                    id,
                    selector(get => callback(get(family(id)), term)),
                )
            })
            return itemSelectorMap
        })
        const filteredSelector = selector(get => {
            const map = get(selectorMapIndex)
            const res: K[] = []
            map.forEach((selector, key) => {
                if (get(selector)) {
                    res.push(key)
                }
            })
            return res
        })
        map.set(termKey, filteredSelector)
        return filteredSelector
    }
}
