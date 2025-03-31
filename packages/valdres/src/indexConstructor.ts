import { stableStringify } from "./lib/stableStringify"
import { selector } from "./selector"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"
import type { Selector } from "./types/Selector"

export const index = <
    Term,
    Value extends any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, FamilyArgs>,
    callback: (value: Value, term: Term) => boolean,
    options?: { name?: string },
): ((term: Term) => Selector<Term[]>) => {
    const map = new Map()
    const indexFn = (term: Term) => {
        const termKey = stableStringify(term)
        if (map.has(termKey)) return map.get(termKey)

        const termIndexSelectorSet = new Set<
            AtomFamilyAtom<Value, FamilyArgs>
        >()
        const termIndexSelectorMap = new Map()
        const termIndexSelector = selector(
            get => {
                const allFamilyAtoms = new Set(get(family))
                const deletedAtoms =
                    termIndexSelectorSet.symmetricDifference(allFamilyAtoms)
                const addedAtoms =
                    allFamilyAtoms.difference(termIndexSelectorSet)

                if (deletedAtoms.size || addedAtoms.size) {
                    deletedAtoms.forEach(atom => {
                        termIndexSelectorSet.delete(atom)
                        termIndexSelectorMap.delete(atom)
                    })
                    addedAtoms.forEach(atom => {
                        termIndexSelectorSet.add(atom)
                        termIndexSelectorMap.set(
                            atom,
                            // the callback triggers on delete. Should be avoided
                            selector(get => callback(get(atom), term), {
                                name: `index:callback:selector:${atom.name}`,
                            }),
                        )
                    })
                }

                return termIndexSelectorSet
            },
            { name: `index:${options?.name}:${termKey}` },
        )

        const filteredSelector = selector(
            get => {
                const set = get(termIndexSelector)
                const res: AtomFamilyAtom<Value, FamilyArgs>[] = []
                set.forEach(atom => {
                    if (get(termIndexSelectorMap.get(atom))) {
                        res.push(atom)
                    }
                })
                return res
            },
            {
                name: `index:${options?.name}:${termKey}:termSelector`,
            },
        )
        map.set(termKey, filteredSelector)
        return filteredSelector
    }
    return Object.assign(indexFn, {
        map,
    })
}
