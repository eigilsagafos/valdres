# Field-Specific Filtering

The search index now supports powerful field-specific filtering with AND/OR logic!

## Features

- ✅ **Field-based filters** - Filter by any field value
- ✅ **Multiple operators** - equals, contains, startsWith, endsWith, gt, gte, lt, lte, in
- ✅ **AND/OR logic** - Combine filters with boolean operators
- ✅ **Nested groups** - Complex filter logic with nested conditions
- ✅ **Combined with text search** - Filter results from full-text queries
- ✅ **Filter-only queries** - Use filters without text search

## Basic Usage

### Simple Field Filter

```typescript
import { createSearchIndex } from '@valdres/search'

const postSearch = createSearchIndex(store, posts, {
  fields: ['title', 'content']
})

// Search for "javascript" where entity="tutorial"
const results = await postSearch.search('javascript', {
  filter: {
    field: 'entity',
    value: 'tutorial',
    operator: 'equals'  // default operator
  }
})
```

### Filter-Only Query

```typescript
// No text search, just filtering
const results = await postSearch.search('', {
  filter: {
    field: 'status',
    value: 'published'
  }
})
```

## Operators

### equals (default)
Exact match comparison.

```typescript
filter: {
  field: 'status',
  value: 'published'
}
```

### contains
Check if value contains a substring or array element.

```typescript
// Array contains
filter: {
  field: 'tags',
  value: 'javascript',
  operator: 'contains'
}

// String contains
filter: {
  field: 'email',
  value: '@example.com',
  operator: 'contains'
}
```

### startsWith / endsWith
String prefix/suffix matching.

```typescript
filter: {
  field: 'filename',
  value: 'document',
  operator: 'startsWith'
}

filter: {
  field: 'filename',
  value: '.pdf',
  operator: 'endsWith'
}
```

### Comparison Operators
Numeric comparisons: gt, gte, lt, lte

```typescript
// Price greater than 100
filter: {
  field: 'price',
  value: 100,
  operator: 'gt'
}

// Rating >= 4.5
filter: {
  field: 'rating',
  value: 4.5,
  operator: 'gte'
}
```

### in
Check if field value is in an array.

```typescript
filter: {
  field: 'role',
  value: ['admin', 'moderator'],
  operator: 'in'
}
```

## Boolean Logic

### AND Groups

All conditions must be true.

```typescript
const results = await search('widget', {
  filter: {
    operator: 'AND',
    conditions: [
      { field: 'category', value: 'tools' },
      { field: 'price', value: 50, operator: 'lte' },
      { field: 'inStock', value: true }
    ]
  }
})
```

### OR Groups

At least one condition must be true.

```typescript
const results = await search('post', {
  filter: {
    operator: 'OR',
    conditions: [
      { field: 'status', value: 'published' },
      { field: 'status', value: 'featured' }
    ]
  }
})
```

### Nested Groups

Combine AND/OR for complex logic.

```typescript
// (category='frontend' AND author='alice') OR category='backend'
const results = await search('tutorial', {
  filter: {
    operator: 'OR',
    conditions: [
      {
        operator: 'AND',
        conditions: [
          { field: 'category', value: 'frontend' },
          { field: 'author', value: 'alice' }
        ]
      },
      { field: 'category', value: 'backend' }
    ]
  }
})
```

## Real-World Examples

### E-commerce Product Search

```typescript
const productSearch = createSearchIndex(store, products, {
  fields: ['name', 'description']
})

// Search for "laptop" under $1000, in stock, 4+ star rating
const results = await productSearch.search('laptop', {
  filter: {
    operator: 'AND',
    conditions: [
      { field: 'price', value: 1000, operator: 'lte' },
      { field: 'inStock', value: true },
      { field: 'rating', value: 4, operator: 'gte' }
    ]
  },
  limit: 20
})
```

### Blog Post Filtering

```typescript
const postSearch = createSearchIndex(store, posts, {
  fields: ['title', 'content', 'excerpt']
})

// Published posts by specific authors
const results = await postSearch.search('javascript', {
  filter: {
    operator: 'AND',
    conditions: [
      { field: 'status', value: 'published' },
      {
        field: 'author',
        value: ['alice', 'bob', 'charlie'],
        operator: 'in'
      }
    ]
  }
})
```

### User Directory

```typescript
const userSearch = createSearchIndex(store, users, {
  fields: ['name', 'bio']
})

// Active users with specific roles
const results = await userSearch.search('engineer', {
  filter: {
    operator: 'AND',
    conditions: [
      { field: 'active', value: true },
      {
        operator: 'OR',
        conditions: [
          { field: 'role', value: 'engineer' },
          { field: 'role', value: 'senior-engineer' }
        ]
      }
    ]
  }
})
```

### Document Management

```typescript
const docSearch = createSearchIndex(store, documents, {
  fields: ['filename', 'content']
})

// Recent PDFs
const results = await docSearch.search('', {
  filter: {
    operator: 'AND',
    conditions: [
      { field: 'filename', value: '.pdf', operator: 'endsWith' },
      { field: 'createdAt', value: Date.now() - 7 * 24 * 60 * 60 * 1000, operator: 'gte' }
    ]
  }
})
```

## TypeScript Types

```typescript
import type { FilterCondition, FilterGroup } from '@valdres/search'

// Single condition
type FilterCondition = {
  field: string
  value: any
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' |
            'gt' | 'gte' | 'lt' | 'lte' | 'in'
}

// Boolean group
type FilterGroup = {
  operator: 'AND' | 'OR'
  conditions: (FilterCondition | FilterGroup)[]
}

// Search options
type SearchOptions = {
  tolerance?: number
  limit?: number
  filter?: FilterCondition | FilterGroup
}
```

## Performance

**Filters are applied AFTER text search**, not during indexing. This means:

- ✅ **No index bloat** - Filters don't increase index size
- ✅ **Flexible** - Any field can be filtered, even if not indexed for search
- ✅ **Fast** - Filters only evaluate on search results, not all documents
- ⚠️ **Post-filter** - Large result sets filter slower (mitigate with `limit`)

### Optimization Tips

1. **Use text search to narrow results first**
   ```typescript
   // Good: Text search reduces to 100 results, then filter
   search('javascript', { filter: ... })

   // Less efficient: Filter all 10,000 documents
   search('', { filter: ... })
   ```

2. **Place selective filters in AND groups first**
   ```typescript
   // Better: Check rare condition first
   {
     operator: 'AND',
     conditions: [
       { field: 'featured', value: true },  // Filters out 90%
       { field: 'category', value: 'tech' } // Then check this
     ]
   }
   ```

3. **Use limit to avoid filtering thousands of results**
   ```typescript
   search('query', {
     filter: ...,
     limit: 100  // Stop after 100 matches
   })
   ```

## Combining with Other Features

### With Fuzzy Search

```typescript
const results = await search('javascrpt', {  // Typo!
  tolerance: 1,  // Allow 1 typo
  filter: {
    field: 'category',
    value: 'tutorial'
  }
})
```

### With Result Limiting

```typescript
const results = await search('react', {
  filter: {
    field: 'difficulty',
    value: 'beginner'
  },
  limit: 10  // Top 10 results only
})
```

### With Sync Search

```typescript
// Works with synchronous search too
const results = index.searchSync('vue', {
  filter: {
    field: 'published',
    value: true
  }
})
```

## Edge Cases

### Empty Query with Filter

```typescript
// Valid: Returns all documents matching filter
const published = await search('', {
  filter: { field: 'status', value: 'published' }
})
```

### Null/Undefined Fields

```typescript
// If field doesn't exist on document, condition fails
filter: {
  field: 'optionalField',
  value: 'something'
}
// Documents without 'optionalField' won't match
```

### Array vs String Contains

```typescript
// Arrays: element match
tags: ['js', 'react']
filter: { field: 'tags', value: 'react', operator: 'contains' }  // ✅ Match

// Strings: substring match
email: 'user@example.com'
filter: { field: 'email', value: 'example', operator: 'contains' }  // ✅ Match
```

## Future Enhancements

Potential features for future versions:

- [ ] **Indexed filters** - Pre-index common filter fields for faster filtering
- [ ] **Range operators** - `between`, `notBetween`
- [ ] **Null checks** - `isNull`, `isNotNull`
- [ ] **Regex operator** - Pattern matching
- [ ] **Custom operators** - User-defined filter logic
- [ ] **Filter stats** - Track which filters are slow

## Migration from Simple Search

**Before** (text search only):
```typescript
const results = await search('javascript')
// Then manually filter in application code
const tutorials = results.filter(r =>
  store.get(r.atom).entity === 'tutorial'
)
```

**After** (built-in filtering):
```typescript
const results = await search('javascript', {
  filter: { field: 'entity', value: 'tutorial' }
})
```

Benefits:
- Cleaner code
- Type-safe filters
- Composable logic
- Consistent API
