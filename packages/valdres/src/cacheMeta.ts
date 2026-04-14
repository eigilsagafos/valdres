import { getOrCreateCacheMetaAtom, type CacheMeta } from "./lib/cacheMetaAtoms"
import { selector } from "./selector"
import type { Atom } from "./types/Atom"
import type { Selector } from "./types/Selector"

const map = new WeakMap<Atom, Selector<CacheMeta | null>>()

export const cacheMeta = (
    sourceAtom: Atom,
): Selector<CacheMeta | null> => {
    const cached = map.get(sourceAtom)
    if (cached) return cached

    const metaAtom = getOrCreateCacheMetaAtom(sourceAtom)
    const sel = selector(get => get(metaAtom))
    map.set(sourceAtom, sel)
    return sel
}
