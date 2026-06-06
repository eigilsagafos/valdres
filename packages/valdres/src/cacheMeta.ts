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
    return sourceAtom.__cacheMetaSelector
}
