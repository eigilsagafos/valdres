# @valdres/search

Full-text search with fuzzy matching for Valdres atom families.

## Features

- 🔍 **Fuzzy search** with typo tolerance using Levenshtein distance
- ⚡ **Fast** hybrid trigram + Levenshtein algorithm for scale
- 🎯 **Configurable** tolerance and field selection
- 🔄 **Automatic** index updates when atoms change
- 📊 **Scored results** with match highlighting
- 🪶 **Lightweight** ~310 lines, zero dependencies

## Installation

```bash
npm install @valdres/search valdres
```

## Quick Start

```typescript
import { atomFamily, store } from 'valdres'
import { createSearchIndex } from '@valdres/search'

// Create an atom family
const posts = atomFamily()
const myStore = store()

// Create search index
const postSearch = createSearchIndex(myStore, posts, {
  fields: ['title', 'content'], // Which fields to index
  tolerance: 1 // Allow 1 typo (default: 1)
})

// Add some data
myStore.set(posts('1'), {
  title: 'JavaScript Tutorial',
  content: 'Learn JavaScript basics'
})

myStore.set(posts('2'), {
  title: 'TypeScript Guide',
  content: 'Advanced TypeScript patterns'
})

// Search (supports typos!)
const results = postSearch.search('javascrpt') // Missing 'i'
// Returns: [{ atom, score: 0.9, matches: ['javascript'] }]

// Get the actual values
results.forEach(result => {
  const post = myStore.get(result.atom)
  console.log(post.title, 'Score:', result.score)
})
```

## API

### `createSearchIndex(store, family, config?)`

Creates a search index for an atom family.

**Parameters:**
- `store` - Valdres store instance
- `family` - Atom family to index
- `config` - Optional configuration

**Config options:**
```typescript
{
  fields?: string[]              // Fields to index (default: all)
  extract?: (value) => string    // Custom text extraction
  tolerance?: number             // Default typo tolerance (default: 1)
}
```

**Returns:** Search index object

### `searchIndex.search(query, options?)`

Search the index for matching atoms.

**Parameters:**
- `query` - Search query string
- `options` - Optional search options

**Options:**
```typescript
{
  tolerance?: number  // Override default tolerance
  limit?: number      // Limit number of results
}
```

**Returns:**
```typescript
Array<{
  atom: AtomFamilyAtom  // Reference to matching atom
  score: number         // Match score (0-1, higher is better)
  matches: string[]     // Words that matched the query
}>
```

## Examples

### Custom Field Extraction

```typescript
const userSearch = createSearchIndex(store, users, {
  extract: (user) => `${user.firstName} ${user.lastName} ${user.email}`
})
```

### Multi-word Queries

```typescript
// Matches atoms containing both "blue" AND "widget"
const results = searchIndex.search('blue widget')
```

### Adjustable Typo Tolerance

```typescript
// Exact match only
searchIndex.search('hello', { tolerance: 0 })

// Allow 1 typo (default)
searchIndex.search('helo', { tolerance: 1 }) // Matches "hello"

// Allow 2 typos
searchIndex.search('hlo', { tolerance: 2 }) // Matches "hello"
```

### Limit Results

```typescript
// Get top 10 results only
const results = searchIndex.search('query', { limit: 10 })
```

## How It Works

The search index uses a **hybrid approach** for optimal performance:

1. **Trigram indexing** - Breaks words into 3-character chunks for fast candidate filtering
2. **Levenshtein distance** - Precisely scores candidates using edit distance
3. **Automatic updates** - Subscribes to atom changes and keeps index in sync

This approach provides:
- Fast search even with 100,000+ atoms
- Accurate typo tolerance
- Minimal memory overhead

## Performance

- **Indexing:** O(n × m) where n = atoms, m = avg words per atom
- **Search:** O(k × c × w) where k = query words, c = candidates per word, w = avg word length
- **Updates:** O(m) per atom change (incremental)

Typical performance:
- 1,000 atoms: <1ms search time
- 10,000 atoms: <5ms search time
- 100,000 atoms: <20ms search time

## Debug Utilities

```typescript
// Get index statistics
const stats = searchIndex._getStats()
console.log(stats)
// { indexedWords: 1234, indexedAtoms: 100, trigramCount: 5678 }

// Inspect internal indices (for debugging)
searchIndex._getWordIndex()
searchIndex._getTrigramIndex()
```

## Cleanup

```typescript
// Stop watching for atom changes
searchIndex.unsubscribe()
```

## License

MIT
