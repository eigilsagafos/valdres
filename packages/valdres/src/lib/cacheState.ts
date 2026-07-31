import type { Atom } from "../types/Atom"
import type { CacheEntry } from "../types/CacheEntry"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"

const peek = (state: State, data: StoreData): CacheEntry | undefined => {
    if (!Object.hasOwn(data, "cache")) return undefined
    return data.cache!.get(state)
}

const getOrCreate = (state: Atom<any>, data: StoreData): CacheEntry => {
    const cache = data.cache!
    let entry = cache.get(state)
    if (!entry) {
        entry = {}
        cache.set(state, entry)
    }
    return entry
}

const recordWrite = (
    state: Atom<any>,
    data: StoreData,
    writtenAt = Date.now(),
): void => {
    getOrCreate(state, data).lastWriteAt = writtenAt
}

const clearWrite = (state: Atom<any>, data: StoreData): void => {
    const entry = peek(state, data)
    if (!entry) return
    if (entry.release === undefined) {
        data.cache!.delete(state)
    } else {
        entry.lastWriteAt = undefined
    }
}

const installRelease = (
    state: Atom<any>,
    data: StoreData,
    release: () => void,
): (() => void) | undefined => {
    const entry = getOrCreate(state, data)
    const previous = entry.release
    entry.release = release
    return previous
}

const clearRelease = (
    state: Atom<any>,
    data: StoreData,
    release: () => void,
): void => {
    const entry = peek(state, data)
    if (entry?.release !== release) return
    if (entry.lastWriteAt === undefined) {
        data.cache!.delete(state)
    } else {
        entry.release = undefined
    }
}

export const cacheState = {
    peek,
    recordWrite,
    clearWrite,
    installRelease,
    clearRelease,
}
