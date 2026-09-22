/**
 * Lazily resolves one `MediaQueryList` per query string and caches it for the
 * lifetime of the module.
 *
 * `window.matchMedia` allocates a fresh object on every call, and an external
 * source's `getSnapshot` runs on every settlement — so reads and subscriptions
 * must share one instance instead of allocating or re-matching per read.
 * Caching also means `subscribe` attaches to the exact object `getSnapshot`
 * samples, so a `change` event and the value it reports can never disagree.
 *
 * Returns `undefined` when the query cannot be observed at all: a DOM-less
 * runtime (server, worker) or a host without `matchMedia`. Callers map that to
 * the package's documented unavailable value; nothing here throws.
 */
const cache = new Map<string, MediaQueryList>()

export const mediaQuery = (query: string): MediaQueryList | undefined => {
    if (typeof window === "undefined") return undefined
    if (typeof window.matchMedia !== "function") return undefined
    const cached = cache.get(query)
    if (cached !== undefined) return cached
    const created = window.matchMedia(query)
    cache.set(query, created)
    return created
}

/**
 * @internal Drops the cached `MediaQueryList` objects so the next `mediaQuery`
 * call re-resolves through the current `window`. Package-private: it exists so
 * tests can swap the host between cases, and is never re-exported from the
 * package entry.
 */
export const resetMediaQueryCache = (): void => {
    cache.clear()
}
