import { equal } from "./lib/equal"
import { selector } from "./selector"
import type { Atom, CacheMeta } from "./types/Atom"
import type { Selector } from "./types/Selector"

export type { CacheMeta } from "./types/Atom"

export const cacheMeta = (
    sourceAtom: Atom,
): Selector<CacheMeta | null> => {
    if (sourceAtom.__cacheMetaSelector) return sourceAtom.__cacheMetaSelector
    if (!sourceAtom.__cacheMeta) {
        sourceAtom.__cacheMeta = { equal, defaultValue: null, __valdresInternal: true }
    }
    sourceAtom.__cacheMetaSelector = selector(get => get(sourceAtom.__cacheMeta!))
    // Mark internal so a live cacheMeta selector (which caches a value once
    // subscribed) is excluded from store.onChange / store.snapshot, matching the
    // __valdresInternal __cacheMeta atom it reads.
    sourceAtom.__cacheMetaSelector.__valdresInternal = true
    return sourceAtom.__cacheMetaSelector
}
