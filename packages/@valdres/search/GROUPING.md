# Grouping Search Results

The search index supports grouping results by field values, allowing you to organize search results into categories.

## Basic Usage

### Group by Field (Simple)

```typescript
import { createSearchIndex } from '@valdres/search'
import type { GroupedSearchResults } from '@valdres/search'
import { atomFamily, store } from 'valdres'

const products = atomFamily()
const defaultStore = store()

const index = createSearchIndex(defaultStore, products, {
    fields: ['name', 'description']
})

// Add some products
defaultStore.set(products('1'), { name: 'Widget A', category: 'tools' })
defaultStore.set(products('2'), { name: 'Widget B', category: 'gadgets' })
defaultStore.set(products('3'), { name: 'Widget C', category: 'tools' })
defaultStore.set(products('4'), { name: 'Widget D', category: 'gadgets' })

// Group results by category
const results = await index.search('widget', {
    groupBy: 'category'
}) as GroupedSearchResults

// Results structure:
// {
//   "tools": [
//     { atom: ..., score: 1, matches: [...] },
//     { atom: ..., score: 1, matches: [...] }
//   ],
//   "gadgets": [
//     { atom: ..., score: 1, matches: [...] },
//     { atom: ..., score: 1, matches: [...] }
//   ]
// }

console.log(Object.keys(results)) // ['tools', 'gadgets']
console.log(results['tools'].length) // 2
console.log(results['gadgets'].length) // 2
```

### Group with Sorted Groups

You can sort the groups themselves (by group key):

```typescript
const results = await index.search('item', {
    groupBy: {
        field: 'priority',
        sort: 'asc'  // Sort groups alphabetically
    }
}) as GroupedSearchResults

const keys = Object.keys(results)
// ['high', 'low', 'medium'] - sorted alphabetically
```

## Working with Grouped Results

### Iterating Over Groups

```typescript
const results = await index.search('widget', {
    groupBy: 'category'
}) as GroupedSearchResults

// Iterate over each group
Object.entries(results).forEach(([category, items]) => {
    console.log(`Category: ${category}`)
    items.forEach(item => {
        const data = defaultStore.get(item.atom)
        console.log(`  - ${data.name} (score: ${item.score})`)
    })
})
```

### Accessing Specific Groups

```typescript
const results = await index.search('widget', {
    groupBy: 'category'
}) as GroupedSearchResults

// Get just the tools group
const toolsItems = results['tools'] || []

// Get count of items in each group
const gadgetsCount = results['gadgets']?.length || 0
```

## Combine with Other Features

### Grouping + Filtering

Filter results first, then group them:

```typescript
const results = await index.search('widget', {
    filter: { field: 'inStock', value: true },
    groupBy: 'category'
}) as GroupedSearchResults

// Only in-stock items, grouped by category
```

### Grouping + Sorting

Sort items within each group:

```typescript
const results = await index.search('widget', {
    sort: { field: 'price', order: 'asc' },
    groupBy: 'category'
}) as GroupedSearchResults

// Within each category group, items are sorted by price (low to high)
```

### Full Example: Filter + Sort + Group

```typescript
const results = await index.search('widget', {
    filter: { field: 'inStock', value: true },
    sort: { field: 'price', order: 'asc' },
    groupBy: { field: 'category', sort: 'desc' }
}) as GroupedSearchResults

// 1. Filter: Only in-stock items
// 2. Sort: Items sorted by price within each group
// 3. Group: Grouped by category with categories sorted Z→A
```

## Data Type Support

Grouping works with any field type:

### String Fields
```typescript
groupBy: 'category'  // Groups: "tools", "gadgets", etc.
```

### Numeric Fields
```typescript
groupBy: 'score'  // Groups: "5", "3", "10", etc. (as strings)
```

### Boolean Fields
```typescript
groupBy: 'featured'  // Groups: "true", "false"
```

### Null/Undefined Values
Items with null or undefined values are grouped under the special key `"__null__"`:

```typescript
const results = await index.search('widget', {
    groupBy: 'category'
}) as GroupedSearchResults

// Items without a category value
const uncategorized = results['__null__'] || []
```

## Type Safety

The return type changes when grouping is used:

```typescript
import type { SearchResult, GroupedSearchResults } from '@valdres/search'

// Without grouping: returns SearchResult[]
const flatResults = await index.search('widget')
// Type: SearchResult[]

// With grouping: returns GroupedSearchResults
const groupedResults = await index.search('widget', {
    groupBy: 'category'
}) as GroupedSearchResults
// Type: { [key: string]: SearchResult[] }
```

## Configuration Options

```typescript
// Simple: Just specify the field name
groupBy: 'category'

// Advanced: Specify field and sort order for groups
groupBy: {
    field: 'category',
    sort: 'asc' | 'desc'  // Optional: sort group keys
}
```

## Behavior with Limit

**Important**: When `groupBy` is specified, the `limit` option is **ignored**. This ensures all groups are complete:

```typescript
// limit is ignored when groupBy is present
const results = await index.search('widget', {
    limit: 2,        // Ignored!
    groupBy: 'category'
})

// All matching results are returned, grouped by category
```

If you need to limit results within groups, apply the limit after grouping:

```typescript
const results = await index.search('widget', {
    groupBy: 'category'
}) as GroupedSearchResults

// Limit each group to 5 items
const limitedResults = Object.fromEntries(
    Object.entries(results).map(([key, items]) => [
        key,
        items.slice(0, 5)
    ])
)
```

## Synchronous Search

Grouping works with both async and sync search methods:

```typescript
const results = index.searchSync('widget', {
    groupBy: 'category'
}) as GroupedSearchResults
```

## Use Cases

### 1. E-commerce Product Catalog
```typescript
// Group products by category
const results = await index.search(query, {
    filter: { field: 'inStock', value: true },
    sort: { field: 'price', order: 'asc' },
    groupBy: 'category'
})

// Display products organized by category
```

### 2. Task Management
```typescript
// Group tasks by priority
const results = await index.search(query, {
    groupBy: { field: 'priority', sort: 'desc' }
})

// Show high priority tasks first
```

### 3. Content Organization
```typescript
// Group articles by status
const results = await index.search(query, {
    groupBy: 'status'
})

// Display: Published, Draft, Archived sections
```

### 4. User Management
```typescript
// Group users by role
const results = await index.search(query, {
    sort: { field: 'name', order: 'asc' },
    groupBy: 'role'
})

// Show users organized by role (Admin, Editor, Viewer)
```

## Performance Considerations

- Grouping happens **after** filtering and sorting
- All matching results are grouped (limit is not applied)
- Group key sorting is done alphabetically using `localeCompare()`
- Groups are stored as plain JavaScript objects with string keys
