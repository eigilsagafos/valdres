# Async Search Without Suspense

The `createDynamicLiveSearchAsync` function provides a way to use async search with reactive updates **without triggering React Suspense**. This is useful when you want the benefits of async search (waits for index to be ready) while maintaining a smooth UX without loading fallbacks.

## The Problem

When using async selectors in React with Valdres, they trigger Suspense boundaries, causing the entire component tree to unmount and show a fallback. This can create a jarring user experience, especially for search where you want to show previous results while new results load.

## The Solution

`createDynamicLiveSearchAsync` caches results in atoms and performs searches in the background, updating the atoms when complete. This provides:

1. **No Suspense** - Results atom is always synchronous
2. **Loading states** - Explicit loading indicator via `isLoadingAtom`
3. **Previous results** - Shows old results while new search runs
4. **Reactive updates** - Automatically re-searches when dependencies change

## Basic Usage

```typescript
import { createDynamicLiveSearchAsync } from '@valdres/search'
import { atom, store, atomFamily } from 'valdres'

const products = atomFamily()
const defaultStore = store()

const index = createSearchIndex(defaultStore, products, {
    fields: ['name', 'description']
})

// Create reactive search atoms
const searchQueryAtom = atom('')
const filterCategoryAtom = atom<string | null>(null)

// Set initial values
defaultStore.set(searchQueryAtom, 'widget')
defaultStore.set(filterCategoryAtom, null)

// Create async live search
const { resultsAtom, isLoadingAtom } = createDynamicLiveSearchAsync(
    defaultStore,
    index,
    (get) => {
        const query = get(searchQueryAtom)
        const category = get(filterCategoryAtom)

        return {
            query,
            options: category ? {
                filter: { field: 'category', value: category }
            } : undefined
        }
    }
)
```

## React Integration

```typescript
import { useValue } from '@valdres/react'

function SearchResults() {
    const results = useValue(resultsAtom)
    const isLoading = useValue(isLoadingAtom)

    return (
        <div>
            {/* Show loading indicator while searching */}
            {isLoading && (
                <div className="spinner">Searching...</div>
            )}

            {/* Results stay visible during loading */}
            <div className={isLoading ? 'opacity-50' : ''}>
                {results.map(result => {
                    const product = store.get(result.atom)
                    return (
                        <div key={result.atom.toString()}>
                            <h3>{product.name}</h3>
                            <p>Score: {result.score}</p>
                        </div>
                    )
                })}
            </div>

            {!isLoading && results.length === 0 && (
                <div>No results found</div>
            )}
        </div>
    )
}

function SearchBar() {
    const query = useValue(searchQueryAtom)

    return (
        <input
            value={query}
            onChange={e => store.set(searchQueryAtom, e.target.value)}
            placeholder="Search products..."
        />
    )
}

function App() {
    return (
        <div>
            <SearchBar />
            {/* No Suspense boundary needed! */}
            <SearchResults />
        </div>
    )
}
```

## How It Works

1. **Creates two atoms**:
   - `resultsAtom`: Stores the current search results
   - `isLoadingAtom`: Tracks whether a search is in progress

2. **Creates a selector**: Tracks all your dependencies (query atom, filter atoms, index changes)

3. **Subscribes to changes**: When any dependency changes, triggers a new background search

4. **Updates atomically**: When search completes, updates both atoms synchronously

## Comparison with Other Approaches

### createDynamicLiveSearch (Sync)
```typescript
const searchResults = createDynamicLiveSearch(index, (get) => ({
    query: get(queryAtom),
    options: get(optionsAtom)
}))

// ✅ Pros:
// - Simple API (returns single selector)
// - Synchronous (no Suspense)
// - Fast (uses searchSync)

// ❌ Cons:
// - Returns empty array if index not ready
// - No loading indicators
```

### createLiveSearch (Async with Suspense)
```typescript
const searchResults = createLiveSearch(index, {
    query: 'widget',
    options: { ... }
})

// ✅ Pros:
// - Waits for index to be ready
// - Uses async search

// ❌ Cons:
// - Triggers Suspense (entire component unmounts)
// - Requires Suspense boundary
// - Jarring UX for search
```

### createDynamicLiveSearchAsync (Async without Suspense)
```typescript
const { resultsAtom, isLoadingAtom } = createDynamicLiveSearchAsync(
    store,
    index,
    (get) => ({ query: get(queryAtom), options: get(optionsAtom) })
)

// ✅ Pros:
// - Waits for index to be ready
// - No Suspense (smooth UX)
// - Explicit loading states
// - Shows previous results while loading
// - Fully reactive

// ❌ Cons:
// - Slightly more complex API (returns object with two atoms)
// - Requires store parameter
```

## Advanced Examples

### With Filters and Sorting

```typescript
const searchQueryAtom = atom('')
const categoryFilterAtom = atom<string | null>(null)
const sortFieldAtom = atom('price')
const sortOrderAtom = atom<'asc' | 'desc'>('asc')

const { resultsAtom, isLoadingAtom } = createDynamicLiveSearchAsync(
    store,
    index,
    (get) => {
        const query = get(searchQueryAtom)
        const category = get(categoryFilterAtom)
        const sortField = get(sortFieldAtom)
        const sortOrder = get(sortOrderAtom)

        return {
            query,
            options: {
                filter: category ? { field: 'category', value: category } : undefined,
                sort: { field: sortField, order: sortOrder }
            }
        }
    }
)

// Automatically re-searches when any atom changes
```

### With Debouncing

For better UX, you might want to debounce rapid changes:

```typescript
import { atom, selector } from 'valdres'

const searchInputAtom = atom('')

// Debounced version (you'd implement debounce logic)
const debouncedQuerySelector = selector((get) => {
    const input = get(searchInputAtom)
    // In real implementation, use a debounce mechanism
    return input
})

const { resultsAtom, isLoadingAtom } = createDynamicLiveSearchAsync(
    store,
    index,
    (get) => ({
        query: get(debouncedQuerySelector)
    })
)
```

### Loading States UI

Different ways to show loading:

```typescript
function SearchResults() {
    const results = useValue(resultsAtom)
    const isLoading = useValue(isLoadingAtom)

    // Option 1: Overlay spinner
    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                    <Spinner />
                </div>
            )}
            <ResultsList results={results} />
        </div>
    )

    // Option 2: Inline indicator
    return (
        <div>
            <div className="flex items-center gap-2">
                <h2>Results</h2>
                {isLoading && <Spinner size="small" />}
            </div>
            <ResultsList results={results} />
        </div>
    )

    // Option 3: Fade effect
    return (
        <div className={`transition-opacity ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
            <ResultsList results={results} />
        </div>
    )
}
```

## TypeScript Types

```typescript
type DynamicLiveSearchAsyncReturn = {
    resultsAtom: Atom<SearchResult[]>
    isLoadingAtom: Atom<boolean>
}

function createDynamicLiveSearchAsync(
    store: Store,
    searchIndex: SearchIndex,
    getSearchParams: (get: Get) => {
        query: string
        options?: SearchOptions
    }
): DynamicLiveSearchAsyncReturn
```

## Performance Considerations

- **Background searches**: Search runs asynchronously without blocking UI
- **Atomic updates**: Results and loading state update together (no flicker)
- **Change detection**: Only searches when params actually change
- **Index tracking**: Automatically re-searches when index data changes

## When to Use

Use `createDynamicLiveSearchAsync` when:

✅ You have dynamic search params (user-controlled query, filters, etc.)
✅ You want smooth UX without Suspense unmounting
✅ You need explicit loading indicators
✅ You want to show previous results while loading
✅ You're okay with slightly more complex API

Use `createDynamicLiveSearch` (sync) when:

✅ You need the simplest API
✅ You're okay with empty results if index not ready
✅ You don't need loading indicators
✅ Performance is critical (synchronous is faster)

Use `createLiveSearch` (async with Suspense) when:

✅ You have static search params
✅ You're okay with Suspense boundaries
✅ You prefer React's built-in loading mechanism
