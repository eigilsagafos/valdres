import type { Selector } from "valdres"
import { equal } from "../../../valdres/src/lib/equal"
import type { SearchOptions, SearchResult } from "./createSearchIndex"

/**
 * Configuration for live search
 */
export type LiveSearchConfig = {
    query: string | (() => string)  // Static query or function that returns query
    options?: SearchOptions | (() => SearchOptions)  // Static options or function
    debounce?: number  // Debounce search updates (ms)
}

/**
 * Create a reactive search selector that automatically updates
 * when the index or query changes (ASYNC version - requires Suspense)
 *
 * Note: This version uses async search which triggers React Suspense.
 * For a synchronous version that doesn't require Suspense, use createLiveSearchSync.
 *
 * @example
 * ```typescript
 * const searchResults = createLiveSearch(index, {
 *   query: 'javascript',
 *   options: { filter: { field: 'status', value: 'published' } }
 * })
 *
 * // Use in React with Suspense
 * function MyComponent() {
 *   return (
 *     <Suspense fallback={<div>Loading...</div>}>
 *       <SearchResults />
 *     </Suspense>
 *   )
 * }
 *
 * function SearchResults() {
 *   const results = useValue(searchResults)
 *   return <div>{results.length} results</div>
 * }
 * ```
 */
export const createLiveSearch = (
    searchIndex: {
        search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
        getStatus: () => { ready: boolean }
        getVersionAtom: () => any
    },
    config: LiveSearchConfig
): Selector<SearchResult[]> => {
    const { query, options, debounce } = config

    // Create a selector that reactively searches
    const selector: Selector<SearchResult[]> = {
        equal,
        get: async (get) => {
            // Subscribe to index version changes
            // This tracks when ANY atom in the index changes, without subscribing to all atoms
            get(searchIndex.getVersionAtom())

            // Get current query (may be from another atom/selector)
            const currentQuery = typeof query === 'function' ? query() : query

            // Get current options (may be from another atom/selector)
            const currentOptions = typeof options === 'function' ? options() : options

            // Wait for index to be ready
            const status = searchIndex.getStatus()
            if (!status.ready) {
                return []
            }

            // Perform search
            const results = await searchIndex.search(currentQuery, currentOptions)
            return results
        },
        key: `liveSearch(${typeof query === 'string' ? query : 'dynamic'})`,
    }

    return selector
}

/**
 * Create a synchronous reactive search selector (no Suspense needed)
 *
 * This version uses searchSync and is fully synchronous, making it easier to use
 * in React components without needing Suspense boundaries. It still updates
 * reactively when the index or query changes.
 *
 * @example
 * ```typescript
 * const searchResults = createLiveSearchSync(index, {
 *   query: 'javascript',
 *   options: { filter: { field: 'status', value: 'published' } }
 * })
 *
 * // Use in React - no Suspense needed!
 * function SearchResults() {
 *   const results = useValue(searchResults)
 *   return <div>{results.length} results</div>
 * }
 * ```
 */
export const createLiveSearchSync = (
    searchIndex: {
        searchSync: (query: string, options?: SearchOptions) => SearchResult[]
        getVersionAtom: () => any
    },
    config: LiveSearchConfig
): Selector<SearchResult[]> => {
    const { query, options } = config

    const selector: Selector<SearchResult[]> = {
        equal,
        get: (get) => {
            // Subscribe to index version changes
            get(searchIndex.getVersionAtom())

            // Get current query (may be from another atom/selector)
            const currentQuery = typeof query === 'function' ? query() : query

            // Get current options (may be from another atom/selector)
            const currentOptions = typeof options === 'function' ? options() : options

            // Use synchronous search - returns empty array if not ready
            const results = searchIndex.searchSync(currentQuery, currentOptions)
            return results
        },
        key: `liveSearchSync(${typeof query === 'string' ? query : 'dynamic'})`,
    }

    return selector
}

/**
 * Create a live search that depends on other atoms/selectors (SYNC version)
 *
 * This version uses searchSync and is fully synchronous.
 * For async search without Suspense, use createDynamicLiveSearchAsync.
 *
 * @example
 * ```typescript
 * const searchQueryAtom = atom('')
 * const filterStatusAtom = atom<string | null>(null)
 *
 * const searchResults = createDynamicLiveSearch(
 *   index,
 *   (get) => {
 *     const query = get(searchQueryAtom)
 *     const status = get(filterStatusAtom)
 *
 *     return {
 *       query,
 *       options: status ? {
 *         filter: { field: 'status', value: status }
 *       } : undefined
 *     }
 *   }
 * )
 *
 * // Updates automatically when searchQueryAtom or filterStatusAtom change
 * const results = useValue(searchResults)
 * ```
 */
export const createDynamicLiveSearch = (
    searchIndex: {
        searchSync: (query: string, options?: SearchOptions) => SearchResult[]
        getStatus: () => { ready: boolean }
        getVersionAtom: () => any
    },
    getSearchParams: (get: any) => {
        query: string
        options?: SearchOptions
    }
): Selector<SearchResult[]> => {
    const selector: Selector<SearchResult[]> = {
        equal,
        get: (get) => {
            // Subscribe to index version changes
            // This ensures the selector re-runs when any atom in the index changes
            get(searchIndex.getVersionAtom())

            // Get search params - this will track dependencies on other atoms
            const { query, options } = getSearchParams(get)

            // Use synchronous search - returns empty array if not ready
            // This avoids Suspense and makes the selector fully synchronous
            const results = searchIndex.searchSync(query, options)
            return results
        },
        key: 'dynamicLiveSearch',
    }

    return selector
}

/**
 * Create an async live search that depends on other atoms/selectors
 * WITHOUT triggering Suspense.
 *
 * This version uses async search but caches results in an atom to avoid Suspense.
 * Returns previous results while new search is loading.
 *
 * @example
 * ```typescript
 * const searchQueryAtom = atom('')
 * const filterStatusAtom = atom<string | null>(null)
 *
 * const { resultsAtom, isLoadingAtom } = createDynamicLiveSearchAsync(
 *   store,
 *   index,
 *   (get) => {
 *     const query = get(searchQueryAtom)
 *     const status = get(filterStatusAtom)
 *     return { query, options: { filter: { field: 'status', value: status } } }
 *   }
 * )
 *
 * // Use in React - no Suspense needed!
 * function SearchResults() {
 *   const results = useValue(resultsAtom)
 *   const isLoading = useValue(isLoadingAtom)
 *
 *   return (
 *     <div>
 *       {isLoading && <Spinner />}
 *       {results.map(r => ...)}
 *     </div>
 *   )
 * }
 * ```
 */
export const createDynamicLiveSearchAsync = (
    store: any,
    searchIndex: {
        search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
        getStatus: () => { ready: boolean }
        getVersionAtom: () => any
    },
    getSearchParams: (get: any) => {
        query: string
        options?: SearchOptions
    }
) => {
    const { atom, selector } = require('valdres')

    // Atom to store current results
    const resultsAtom = atom<SearchResult[]>([])

    // Atom to track loading state
    const isLoadingAtom = atom(false)

    // Create a selector that tracks dependencies and triggers searches in the background
    const paramsSelector = selector((get: any) => {
        // Subscribe to index version changes
        get(searchIndex.getVersionAtom())

        // Get search params - this will track dependencies on other atoms
        const params = getSearchParams(get)

        return params
    })

    // Track the last params we searched for
    let lastParams: { query: string; options?: SearchOptions } | null = null

    // Function to perform search
    const performSearch = () => {
        // Get current params from selector
        const params = store.get(paramsSelector)

        // Check if params have changed
        const paramsChanged =
            !lastParams ||
            lastParams.query !== params.query ||
            JSON.stringify(lastParams.options) !== JSON.stringify(params.options)

        if (paramsChanged) {
            lastParams = params

            // Set loading state
            store.set(isLoadingAtom, true)

            // Perform async search in the background
            searchIndex
                .search(params.query, params.options)
                .then((results) => {
                    // Update results atom
                    store.set(resultsAtom, results)
                })
                .catch((error) => {
                    console.error('Search error:', error)
                })
                .finally(() => {
                    // Clear loading state
                    store.set(isLoadingAtom, false)
                })
        }
    }

    // Subscribe to params changes and trigger background searches
    store.sub(paramsSelector, performSearch)

    // Trigger initial search immediately
    performSearch()

    return {
        resultsAtom,
        isLoadingAtom,
    }
}

/**
 * Create a live search that watches a family and auto-updates
 *
 * Note: This is now just an alias for createLiveSearch since the version atom
 * efficiently tracks all changes to the index without subscribing to individual atoms.
 *
 * @example
 * ```typescript
 * const searchResults = createFamilyLiveSearch(
 *   store,
 *   index,
 *   postFamily,
 *   { query: 'javascript' }
 * )
 *
 * // Automatically re-runs search when any post in the family changes
 * store.sub(searchResults, (results) => {
 *   console.log('Results updated:', results.length)
 * })
 * ```
 */
export const createFamilyLiveSearch = (
    store: any,
    searchIndex: {
        search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
        getStatus: () => { ready: boolean }
        getVersionAtom: () => any
    },
    family: any,
    config: LiveSearchConfig
): Selector<SearchResult[]> => {
    // The version atom approach is much more efficient than subscribing to all family atoms
    // It tracks all changes to the index with a single atom subscription
    return createLiveSearch(searchIndex, config)
}
