import { createAtomFamilyIndexDescriptor } from "./lib/createAtomFamilyIndexDescriptor"
import { stableStringify } from "./lib/stableStringify"
import type { Atom } from "./types/Atom"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"

export type AtomFamilyIndex<Value, Term, Args extends [any, ...any[]]> = {
    (term: Term): Atom<AtomFamilyAtom<Value, Args>[]>
    /**
     * Drop the cached term atom for `term`. Future calls to the index with
     * this term will allocate a fresh atom, and bucket storage in any store
     * still holds the underlying data. Use when the set of possible terms
     * is unbounded (e.g., user-generated tags) and you know a value will
     * not be queried again.
     */
    release(term: Term): boolean
}

/**
 * Insertion-time equality index over an atomFamily. The extractor maps
 * each family member's value to an array of terms it belongs to; calling
 * the returned function with a term yields a stable atom resolving to
 * the array of family atoms in that bucket.
 *
 *   const post = atomFamily<Post, [string]>(null)
 *   const postsByTag = atomFamilyIndex(post, p => p.tags)
 *
 *   s.set(post("1"), { id: "1", tags: ["foo", "bar"] })
 *   s.get(postsByTag("foo"))       // [post("1")]
 *   s.sub(postsByTag("foo"), () => {})  // fires when bucket changes
 *
 * Extractor returning `null` / `undefined` / `[]` excludes the atom from
 * every bucket. Scoped stores inherit buckets from the parent and shadow
 * with their own local writes.
 *
 * Lifetime: term atoms are created lazily on first query and cleaned up
 * automatically when their last subscriber detaches. For terms read but
 * never subscribed, call `index.release(term)` to free memory.
 */
export const atomFamilyIndex = <
    Value extends any,
    Term,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    extractor: (value: Value) => readonly Term[] | null | undefined,
    options?: { name?: string },
): AtomFamilyIndex<Value, Term, Args> => {
    const { descriptor, getTermAtomByKey, releaseTermAtom } =
        createAtomFamilyIndexDescriptor(extractor, options)
    if (!family.__valdresIndexes) {
        family.__valdresIndexes = new Set()
    }
    family.__valdresIndexes.add(descriptor)

    // Descriptor stores `AtomFamilyAtom<any>` internally so a single
    // heterogeneous `Set<IndexDescriptor>` can hold descriptors for any
    // family-member shape. Narrow back to `<Value, Args>` here — same
    // object at runtime; TS requires `as unknown as` for cross-generic
    // narrowing (rejects a single `as` with TS2352).
    const indexFn = ((term: Term) =>
        getTermAtomByKey(stableStringify(term)) as unknown as Atom<
            AtomFamilyAtom<Value, Args>[]
        >) as AtomFamilyIndex<Value, Term, Args>

    indexFn.release = (term: Term) =>
        releaseTermAtom(stableStringify(term))

    return indexFn
}
