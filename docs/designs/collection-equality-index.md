# Native scalar equality collection index

This implements the first ShiftX `entityRefsByKindIndex` workload using the
collection delta substrate. The existing query-construction spike selected
standalone ownership and object grammar; this slice implements its single `eq`
leaf. It does not reopen the API comparison.

## Public API

```ts
import { collection, store } from "valdres"
import { query } from "valdres/query"

type EntityRef = `entity:${string}`
type Entity = { kind: "task" | "person" | "document"; title: string }
type EntityIndexes = { kind: Entity["kind"] }

const entities = collection<EntityRef, Entity, EntityRef, EntityIndexes>({
    indexes: { kind: entity => entity.kind },
})
const entityRefsByKindIndex = (kind: Entity["kind"]) =>
    query(entities, { where: { kind: { eq: kind } } })
const tasks = entityRefsByKindIndex("task")
const app = store()
app.set(entities("entity:one"), { kind: "task", title: "Write docs" })
app.get(tasks) // readonly CollectionRow<EntityRef, Entity>[]
```

`collection<Key, Value, Input = Key, Indexes = never>(options)` preserves the
existing key/input order. `Indexes` maps declared index names to scalar types;
`options.indexes` maps the same names to synchronous value extractors. Explicit
index metadata is necessary when the key and value generic arguments are given
(TypeScript cannot partially infer later generic arguments). The index is
non-unique. Extractors must be pure and return strings, finite numbers,
booleans, bigints, or null. Equality distinguishes primitive types and treats -0
as 0. Undefined, NaN, infinity, symbols, objects and thenables are rejected.

`query(collection, { where: { indexName: { eq: value } } })` returns a readable
`State<readonly CollectionRow<Key, Value>[]>`. Keep the query definition when
subscribing or repeatedly looking it up. Definitions are store-independent; each
store/scope materializes its own index lazily. Different queries over the same
index share its materialization and bucket snapshots. Query construction runs no
extractor. `family()` continues to accept only atoms and selectors.

## Commit and scope behavior

- The first committed read scans present membership once per scope/index. Absent
  rows never reach an extractor. Merely declaring an index or creating an unread
  query allocates no per-store index state.
- Commit preparation routes effective changed rows through materialized
  collection scope routes. Equal shadows and tombstones use the same final
  outcome and presence history as ordinary collections.
- Extractors run on final present values before any atom or row is applied. An
  exception or invalid scalar aborts the entire transaction. Intermediate
  overwritten values do not need to pass extraction.
- Buckets and query sources publish with the existing collection commit. The
  engine compares row identities in order and reuses unchanged arrays; value
  changes that keep the indexed scalar do not notify row-list subscribers.
- An optional ordered membership map replaces eager membership-array rebuilds
  only after index materialization. Writes update changed links; a reader of the
  whole collection pays to obtain a new membership array. Old internal arrays
  are discarded on change so deleted rows are not pinned by stale snapshots.
- Effective absent-to-present births move rows to the end, including multiple
  writes in a transaction. Index moves preserve the row's membership position.
- Scratch queries use transaction-local scans and memoized immutable results.
  Scratch reads do not materialize committed buckets; their memo is released
  when the transaction closes, including aborts.
- Scope disposal drops buckets and reader maps. Empty lookup buckets are weakly
  held, so unused empty lookups do not accumulate strong scalar/result state.

## Complexity and evidence

Initial materialization is O(N). Warm same-kind value updates perform O(D)
extractor work for D effective changed rows per materialized scope/index. Bucket
membership changes rebuild only affected buckets, costing O(B log B) for B rows
in those buckets; immutable result publication necessarily costs O(B). Warm
lookup reuses the bucket snapshot. Scope propagation additionally visits the
materialized collection routes reached by changed scopes. Full membership reads
and scratch reads may scan N; neither occurs in the committed index-only write
path. Unmaterialized indexes run no extractor and allocate no index records.

`test/performance/collection-index.performance.test.ts` checks 1k/5k/20k:
insert/update/delete each process one delta row, extraction counts are 1/1/0,
affected bucket rows are 11/0/10, and membership arrays are not allocated.
`collection-index.timing.ts` compares the selector full-scan shim and native
index, reporting first materialization separately from insert/update/delete plus
result reads and warm lookup. Timings are diagnostic; deterministic counts are
the scaling gate. The workload has ten tasks and the remaining entities are
documents; larger matching buckets naturally increase result-copy work.

Numeric inspection counters expose materializations, initial rows, extractor
calls, effective delta rows, rebuilt bucket rows and bucket publications. They
retain no application keys or values.

The `valdres/query` subpath owns the query engine. The root collection API does
not import it. Package smoke tests cover shared domain identity across root and
query in native Bun/Node and bundled consumers.

## Deferred

Ordered/range and multi-value indexes; compound Boolean queries; facets,
pagination, joins, full-text/multi-collection search; selector-kernel and family
changes. This is a library acceptance workload, not a claim of a real ShiftX
application migration or production timing.

## Independent review

One read-only Opus review (`claude-opus-5`) checked correctness, scope behavior,
rollback and complexity. Supported findings were addressed:

- Scratch memo invalidation now uses the transaction generation, including
  value-only writes. A regression reads before and after set/update/reset in one
  transaction.
- Unindexed membership nodes retain ordinary data fields. Ordered nodes lazily
  memoize their baseline once; new scope nodes do not recursively chase getters.
- Index propagation uses a separate weak route set containing only activated
  ancestry paths. A root and one indexed child visit two index routes despite
  5,000 membership-only siblings.
- Scratch extraction reads the overlay directly without creating a draft row
  coordinate for every present row. A 5,000-row query followed by one write
  creates one coordinate.
- Active index tracking uses weak records, so anonymous scope GC disarms it. An
  ancestor may retain its ordered _membership representation_ after a child
  index is disposed; its values still belong to that ancestor, and index buckets
  and disposed-scope routes are released. Representation activation is one-way
  until that scope is disposed, avoiding a full collection scan at child
  disposal.
- Query served outcomes are frozen consistently with other collection sources.

The ordered-membership helper remains in the collection implementation; the
standalone query engine and grammar remain absent from collection-only bundles.
Package size checks report feature growth up to 15% as diagnostics; ordinary
isolation, malformed packages, and larger growth remain failures. The historical
COL-008 build hash is diagnostic; three identical current builds are still
required. No historical baselines or sealed evidence bundles were regenerated.

## Final validation after collection names (#395)

Integrated `origin/main` at `48dab241`; the index semantics fixture also
declares `name: "entities"`. TypeScript, tsgo, root typecheck, package
validation including damaged-package self-tests, and packed
Node/Bun/TypeScript/esbuild/React 18/19 consumers pass. Separate Bun runs pass
232 collection/inspection/build tests, 288 kernel tests, and 25 subscription
tests; Node passes 16 index tests. The combined run had 547 passes and one
GC-sensitive subscription failure; its unchanged subscription file passes all 25
tests in isolation.

One diagnostic run at 20,000 entities (ten matching tasks), including a result
read after each write:

| Runtime / implementation | Initial (ms) | Insert (µs) | Update (µs) | Delete (µs) | Warm lookup (µs) |
| ------------------------ | -----------: | ----------: | ----------: | ----------: | ---------------: |
| bun / native             |        16.36 |       10.15 |        6.28 |        9.01 |            0.069 |
| bun / selector-shim      |        33.37 |    26488.41 |    11350.43 |    24091.45 |            0.061 |
| node / native            |        25.29 |       14.97 |        9.40 |       13.26 |            0.124 |
| node / selector-shim     |        66.78 |    17197.12 |     6857.24 |    13974.96 |            0.224 |

Across 100 insert/update/delete cycles, native extractor calls remain 200 at
1k/5k/20k entities, versus 300,200 / 1,500,200 / 6,000,200 for the selector
shim. Warm lookup already reuses snapshots in both implementations; incremental
maintenance is the native benefit. Elapsed times are machine-sensitive.

Compressed production plus development distribution size is 88,402 bytes against
the 80,164-byte prior budget (+8,238 bytes, 10.3%). The feature diagnostic
allowance is 15%; immutable ordinary bundle isolation and oversized-package
mutation failures remain enforced.
