import { equal } from "./lib/equal"
import { selector } from "./selector"
import type { Atom, CacheMeta } from "./types/Atom"
import type { InternalAtom } from "./types/InternalAtom"
import type { InternalSelector } from "./types/InternalSelector"
import type { Selector } from "./types/Selector"

export type { CacheMeta } from "./types/Atom"

export const cacheMeta = (sourceAtom: Atom): Selector<CacheMeta | null> => {
    const internalAtom = sourceAtom as InternalAtom
    if (internalAtom.__cacheMetaSelector)
        return internalAtom.__cacheMetaSelector
    if (!internalAtom.__cacheMeta) {
        internalAtom.__cacheMeta = {
            equal,
            defaultValue: null,
            __valdresInternal: true,
        }
    }
    internalAtom.__cacheMetaSelector = selector(get =>
        get(internalAtom.__cacheMeta!),
    ) as InternalSelector<CacheMeta | null>
    // Mark internal so a live cacheMeta selector (which caches a value once
    // subscribed) is excluded from store.onChange / store.snapshot, matching the
    // __valdresInternal __cacheMeta atom it reads.
    internalAtom.__cacheMetaSelector.__valdresInternal = true
    return internalAtom.__cacheMetaSelector
}
