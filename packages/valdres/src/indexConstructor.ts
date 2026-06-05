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
        // Store-agnostic on purpose: a selector is a pure definition that valdres
        // evaluates independently per store, so the same predicate selector is
        // correct in the root and in every scope. The previous index() design
        // kept a mutable Set + Map of "current members" in this closure and
        // mutated them from inside a `termIndexSelector` evaluation. Because that
        // evaluation runs per store — and a scope can have a different family
        // membership than the root (publish moves members between a scope and the
        // root) — the two stores clobbered the shared state: `termSelector` in
        // one store could iterate a snapshot set that still held a member whose
        // predicate-selector entry had already been deleted by the other store's
        // evaluation, and `get(undefined)` threw. Deriving membership from
        // `get(family)` on every evaluation makes each store read its own correct
        // membership, and the cache lookup is never undefined for a live member.
        //
        // A WeakMap (not a Map) keyed by the family-atom object: deleting a
        // member calls family.release(...), so a deleted-and-recreated key mints
        // a fresh atom identity; a strong Map would retain one dead entry per
        // create/delete/recreate cycle (unbounded under churn). The WeakMap lets
        // a released member's entry (and its predicate selector) become
        // GC-eligible, bounding the cache by live membership.
        const predicateSelectors = new WeakMap<
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
