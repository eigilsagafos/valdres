# Sorting Search Results

The search index supports sorting results by field values with ascending or descending order.

## Basic Usage

### Sort by Single Field

```typescript
import { createSearchIndex } from '@valdres/search'
import { atomFamily, store } from 'valdres'

const products = atomFamily()
const defaultStore = store()

const index = createSearchIndex(defaultStore, products, {
    fields: ['name', 'description']
})

// Add some products
defaultStore.set(products('1'), { name: 'Widget A', price: 30 })
defaultStore.set(products('2'), { name: 'Widget B', price: 10 })
defaultStore.set(products('3'), { name: 'Widget C', price: 20 })

// Sort by price ascending (lowest to highest)
const results = await index.search('widget', {
    sort: { field: 'price', order: 'asc' }
})
// Results: Widget B ($10), Widget C ($20), Widget A ($30)

// Sort by price descending (highest to lowest)
const results2 = await index.search('widget', {
    sort: { field: 'price', order: 'desc' }
})
// Results: Widget A ($30), Widget C ($20), Widget B ($10)
```

### Sort by Multiple Fields

You can sort by multiple fields for more complex ordering:

```typescript
const items = atomFamily()
const defaultStore = store()

const index = createSearchIndex(defaultStore, items, {
    fields: ['name']
})

defaultStore.set(items('1'), { name: 'Item', category: 'A', price: 30 })
defaultStore.set(items('2'), { name: 'Item', category: 'B', price: 10 })
defaultStore.set(items('3'), { name: 'Item', category: 'A', price: 20 })
defaultStore.set(items('4'), { name: 'Item', category: 'B', price: 15 })

// Sort by category first (ascending), then by price (descending) within each category
const results = await index.search('item', {
    sort: [
        { field: 'category', order: 'asc' },
        { field: 'price', order: 'desc' }
    ]
})
// Results:
// 1. category: A, price: 30
// 2. category: A, price: 20
// 3. category: B, price: 15
// 4. category: B, price: 10
```

## Combine with Filtering

Sorting works seamlessly with filtering:

```typescript
const results = await index.search('widget', {
    filter: { field: 'inStock', value: true },
    sort: { field: 'price', order: 'asc' }
})
// Returns only in-stock items, sorted by price
```

## Sort Order

- **`'asc'`** (ascending): Sorts from lowest to highest (A→Z, 0→9)
- **`'desc'`** (descending): Sorts from highest to lowest (Z→A, 9→0)
- **Default**: If no order is specified, defaults to `'asc'`

## Supported Data Types

The sorting function handles different data types appropriately:

- **Strings**: Uses `localeCompare()` for natural language sorting
- **Numbers**: Direct numeric comparison
- **Booleans**: `false` < `true`
- **Null/Undefined**: Always placed at the end of results
- **Mixed types**: Fallback to string comparison

## Default Behavior

When **no sort option** is provided, results are sorted by **search relevance score** (descending), meaning best matches appear first.

When a **sort option is provided**, it overrides the default score-based sorting.

## With Synchronous Search

Sorting works with both async and sync search methods:

```typescript
const results = index.searchSync('widget', {
    sort: { field: 'price', order: 'asc' }
})
```

## TypeScript Types

```typescript
import type { SortConfig } from '@valdres/search'

type SortConfig = {
    field: string           // Field name to sort by
    order?: 'asc' | 'desc'  // Sort order (default: 'asc')
}

// In SearchOptions
type SearchOptions = {
    tolerance?: number
    limit?: number
    filter?: FilterGroup | FilterCondition
    sort?: SortConfig | SortConfig[]  // Single or multiple sort configs
}
```

## Performance Considerations

- Sorting happens **after** filtering, so it only sorts the filtered results
- Multiple field sorting evaluates fields in order (first field takes precedence)
- The `limit` option is applied **after** sorting, so you get the top N sorted results
