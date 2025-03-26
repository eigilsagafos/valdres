import { stableStringify } from "./lib/stableStringify"
import { selector } from "./selector"
import type { AtomFamily } from "./types/AtomFamily"
import type { Selector } from "./types/Selector"

export const index = <
    Term,
    Value extends any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, FamilyArgs>,
    callback: (value: Value, term: Term) => boolean,
): ((term: Term) => Selector<Term[]>) => {
    const map = new Map()
    return (term: Term) => {
        const termKey = stableStringify(term)
        if (map.has(termKey)) return map.get(termKey)
        const itemSelectorMap = new Map()
        const selectorMapIndex = selector(get => {
            const array = get(family)
            array.forEach(args => {
                if (itemSelectorMap.has(args)) return
                itemSelectorMap.set(
                    args,
                    selector(get => callback(get(family(...args)), term)),
                )
            })
            return itemSelectorMap
        })
        const filteredSelector = selector(get => {
            const map = get(selectorMapIndex)
            const res: FamilyArgs[] = []
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
