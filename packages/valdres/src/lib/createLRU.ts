/**
 * A tiny least-recently-used map, backed by a `Map`'s insertion order.
 *
 * `get` and `set` mark a key as most-recently-used (delete + re-insert moves
 * it to the end); when `set` would exceed `capacity`, the oldest keys (front
 * of the Map) are evicted. A non-finite or non-positive `capacity` means
 * unbounded — every entry is kept and nothing is ever evicted.
 *
 * Used by `atomFamilySearch` to bound its per-query selector caches: a
 * search-as-you-type UI issues one distinct query per keystroke, which
 * previously grew the caches without limit (the manual `releaseQuery` escape
 * hatch aside). Active queries that keep being read stay warm; stale ones
 * fall out.
 */
export type LRU<K, V> = {
    get: (key: K) => V | undefined
    set: (key: K, value: V) => void
    has: (key: K) => boolean
    delete: (key: K) => boolean
    clear: () => void
    readonly size: number
}

export const createLRU = <K, V>(capacity: number): LRU<K, V> => {
    const map = new Map<K, V>()
    const bounded = Number.isFinite(capacity) && capacity > 0
    return {
        get(key) {
            const value = map.get(key)
            if (value === undefined && !map.has(key)) return undefined
            // Touch: move to most-recently-used.
            map.delete(key)
            map.set(key, value as V)
            return value
        },
        set(key, value) {
            if (map.has(key)) map.delete(key)
            map.set(key, value)
            if (bounded) {
                while (map.size > capacity) {
                    const oldest = map.keys().next().value as K
                    map.delete(oldest)
                }
            }
        },
        has: key => map.has(key),
        delete: key => map.delete(key),
        clear: () => map.clear(),
        get size() {
            return map.size
        },
    }
}
