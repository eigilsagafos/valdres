import type { Atom } from "../types/Atom"
import { equal } from "./equal"

export type CacheMeta = {
    isRevalidating: boolean
    lastSuccessAt: number
    maxAge: number
    staleWhileRevalidate?: number
    staleIfError?: number
}

const map = new WeakMap<Atom, Atom<CacheMeta | null>>()

export const getOrCreateCacheMetaAtom = (
    sourceAtom: Atom,
): Atom<CacheMeta | null> => {
    let metaAtom = map.get(sourceAtom)
    if (!metaAtom) {
        metaAtom = { equal, defaultValue: null }
        map.set(sourceAtom, metaAtom)
    }
    return metaAtom
}
