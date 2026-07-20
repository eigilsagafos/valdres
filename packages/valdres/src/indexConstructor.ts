import { familyKey, type FamilyKey } from "./lib/familyKey"
import { WeakSelectorCache } from "./lib/WeakSelectorCache"
import { selector } from "./selector"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"
import type { IndexOptions } from "./types/IndexOptions"
import type { Selector } from "./types/Selector"

/**
 * Build a memoized family of reactive selectors that filter an atom family.
 *
 * This is a reactive filter, not a materialized database index. The first read
 * for a term is O(family size). A live term rechecks only the changed member's
 * predicate. If that result flips, rebuilding the ordered result walks the
 * family, so a membership-changing update is O(family size); an unchanged
 * predicate stops after O(1) work. Term-selector cache entries are weak:
 * selector identity is preserved while a caller or live store dependency graph
 * retains it, then both the selector and its term can be collected.
 */
export const index = <
    Term,
    Value extends any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, FamilyArgs>,
    callback: (value: Value, term: Term) => boolean,
    options?: IndexOptions<Term>,
): ((term: Term) => Selector<AtomFamilyAtom<Value, FamilyArgs>[]>) => {
    const map = new WeakSelectorCache<
        FamilyKey,
        Selector<AtomFamilyAtom<Value, FamilyArgs>[]>
    >()
    const keyOf = options?.keyOf
    const index = (term: Term) => {
        const keyValue = keyOf === undefined ? term : keyOf(term)
        const termKey = familyKey([keyValue])
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
        // A WeakMap (not a Map) keyed by the family-atom object: the family's
        // identity cache is weak-valued, so an unused or explicitly released
        // member can eventually be recreated. A strong Map here would retain
        // one dead entry per collected identity (unbounded under churn). The
        // WeakMap lets that member's predicate selector become GC-eligible too,
        // bounding the cache by live identities.
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
                const members = get(family)
                for (const atom of members) {
                    if (get(predicateFor(atom))) res.push(atom)
                }
                return res
            },
            {
                name: `index:${options?.name}:${
                    typeof keyValue === "string" ? keyValue : termKey
                }:termSelector`,
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
