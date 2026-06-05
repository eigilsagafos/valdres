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
): ((term: Term) => Selector<AtomFamilyAtom<Value, FamilyArgs>[]>) => {
    const map = new Map<
        ReturnType<typeof stableStringify>,
        Selector<AtomFamilyAtom<Value, FamilyArgs>[]>
    >()
    const index = (term: Term) => {
        const termKey = stableStringify(term)
        const existing = map.get(termKey)
        if (existing) return existing

        // Per-atom predicate selectors, cached so we don't recreate them on
        // every membership change.
        //
        // This cache is GROW-ONLY and store-agnostic on purpose. A selector is
        // a pure definition that valdres evaluates independently per store, so
        // the same `termSelector` here runs once in the root and once in every
        // scope that reads it. The previous design kept a mutable Set + Map of
        // "current members" in this closure and mutated them from inside a
        // `termIndexSelector` evaluation. Because that evaluation runs per store
        // — and a scope can have a different family membership than the root
        // (publish moves members between a scope and the root) — the two stores
        // clobbered the shared state: `termSelector` in one store could iterate
        // a snapshot set that still held a member whose predicate-selector entry
        // had already been deleted by the other store's evaluation, and
        // `get(undefined)` threw. Deriving membership from `get(family)` on every
        // evaluation makes each store read its own correct membership, and never
        // deleting from the predicate cache means a lookup is never undefined.
        const predicateSelectors = new Map<
            AtomFamilyAtom<Value, FamilyArgs>,
            Selector<boolean>
        >()
        const predicateFor = (atom: AtomFamilyAtom<Value, FamilyArgs>) => {
            let sel = predicateSelectors.get(atom)
            if (!sel) {
                sel = selector(get => callback(get(atom), term), {
                    name: `index:callback:selector:${atom.name}`,
                })
                predicateSelectors.set(atom, sel)
            }
            return sel
        }

        const filteredSelector = selector<AtomFamilyAtom<Value, FamilyArgs>[]>(
            get => {
                const res: AtomFamilyAtom<Value, FamilyArgs>[] = []
                const members = get(family) as AtomFamilyAtom<
                    Value,
                    FamilyArgs
                >[]
                for (const atom of members) {
                    if (get(predicateFor(atom))) res.push(atom)
                }
                return res
            },
            {
                name: `index:${options?.name}:${termKey}:termSelector`,
            },
        )
        map.set(termKey, filteredSelector)
        return filteredSelector
    }
    return Object.assign(index, {
        map,
        callback,
    })
}
