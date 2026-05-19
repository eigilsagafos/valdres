import { createAtomFamilySortDescriptor } from "./lib/createAtomFamilySortDescriptor"
import type { Atom } from "./types/Atom"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"

/**
 * Insertion-time sorted view of an atomFamily. The extractor maps each
 * family member's value to a sort key; the returned atom resolves to
 * the family atoms in sorted order, maintained incrementally on every
 * write.
 *
 *   const post = atomFamily<Post, [string]>(null)
 *   const postsByDate = atomFamilySort(post, p => p.createdAt, {
 *       direction: "desc",
 *   })
 *
 *   s.get(postsByDate)         // [post("2025-..."), post("2024-..."), ...]
 *   s.sub(postsByDate, () => {})
 *
 * Extractor returning `null` / `undefined` excludes the atom from the
 * sorted view. Tied keys break deterministically on `familyArgsStringified`
 * so the order is stable across writes.
 *
 * For `limit` / `offset`, compose a downstream selector over the sorted
 * result rather than adding a knob here.
 */
export const atomFamilySort = <
    Value extends any,
    Key,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    extractor: (value: Value) => Key | null | undefined,
    options?: { direction?: "asc" | "desc"; name?: string },
): Atom<AtomFamilyAtom<Value, Args>[]> => {
    const { descriptor, resultAtom } = createAtomFamilySortDescriptor(
        extractor,
        options,
    )
    if (!family.__valdresIndexes) {
        family.__valdresIndexes = new Set()
    }
    family.__valdresIndexes.add(descriptor)

    // The descriptor uses `AtomFamilyAtom<any>` internally so a single
    // heterogeneous `Set<IndexDescriptor>` can hold descriptors for any
    // family-member shape. Narrow here at the public boundary — same
    // object at runtime, only the static type changes. TypeScript
    // requires `as unknown as` for cross-generic narrowing (a single
    // `as` is rejected with TS2352).
    return resultAtom as unknown as Atom<AtomFamilyAtom<Value, Args>[]>
}
