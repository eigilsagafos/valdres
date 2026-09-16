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
interface EntityIndexes {
    kind: Entity["kind"]
}

const entities = collection<EntityRef, Entity, EntityRef, EntityIndexes>({
    name: "entities",
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
`State<readonly CollectionRow<Key, Value>[]>`. Equivalent
collection/index/scalar lookups share canonical identity while the query State
remains live, using the existing weak tuple cache and SameValueZero scalar
semantics. The cache neither owns query States permanently nor changes their
identity at scope disposal. Definitions are store-independent; each store/scope
materializes its own index lazily. Different queries over the same index share
its materialization and bucket snapshots. Query construction runs no extractor.
`family()` continues to accept only atoms and selectors.

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
membership changes rebuild only affected buckets with live query readers,
costing O(B log B) for B rows in those buckets; immutable result publication
necessarily costs O(B). Warm lookup reuses the bucket snapshot. Scope
propagation additionally visits the materialized collection routes reached by
changed scopes. Full membership reads and scratch reads may scan N; neither
occurs in the committed index-only write path. Unmaterialized indexes run no
extractor and allocate no index records.

`test/performance/collection-index.performance.test.ts` checks 1k/5k/20k:
insert/update/delete each process one delta row, extraction counts are 1/1/0,
affected bucket rows are 11/0/10, and membership arrays are not allocated.
`collection-index.timing.ts` compares the selector full-scan shim and native
index, reporting first materialization separately from insert/update/delete plus
result reads and warm lookup. Timings are diagnostic; deterministic counts are
the scaling gate. The workload has ten tasks and the remaining entities are
documents; larger matching buckets naturally increase result-copy work.

Inspection schema 7 exposes numeric counters for materializations, initial rows,
extractor calls, effective delta rows, rebuilt bucket rows, publications, route
visits, membership groups created, and reader buckets created. They retain no
application keys or values.

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

- Scratch memo invalidation uses a lazy per-collection value revision, including
  value-only writes, without reacting to unrelated atom/collection writes. A
  regression reads before and after set/update/reset in one transaction.
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
Hard package budgets and certified digests remain enforced. The query consumer
has its own reviewed budget; production and development artifacts are measured.
Only relevant feature budgets and the three-build certified digest are updated.

## Merge-readiness repairs

- Named interface index metadata uses a self-mapped scalar constraint.
- The inspection schema is 7, including core, React, packed consumers and docs.
- Lifecycle tests retain mandatory leak assertions, use the family suite's retry
  pattern and a local 60-second timeout under conservative JSC GC.
- Canonical query identities use the existing weak tuple cache; a retained scope
  and collection do not permanently retain a discarded query State.
- Membership groups are separate from reader buckets. Writes to a dominant
  unread group update only changed memberships, without copying/sorting/freezing
  a result. The first later read builds the ordered snapshot. Commit preparation
  remains immutable until all extractors validate, preserving rollback.
- Contracts now admit scalar equality extractors and the `valdres/query` entry.
  Final-v1 compound grammar and operational APIs remain explicitly deferred.
- Release classification is minor; hard package certification is restored.

## Complexity evidence and consciously retained costs

The deterministic 20,000-row dominant-unread test observes zero snapshot rows,
zero reader-bucket allocations and zero publications for mutations in the unread
19,990-row group. After that group is queried, its next membership change
rebuilds 19,990 ordered rows, preserving the existing O(B log B) live-result
contract.

With 20,000 distinct scalars, initial materialization creates 20,000 membership
groups but only one reader bucket and one snapshot row for the one queried
value. A later unread value move processes one delta, creates one membership
group, and creates zero reader buckets/snapshot rows. Retained membership
remains O(N + K) for N rows and K distinct values: each value has a Set of
matching row handles. This deliberately accepted cost enables incremental lookup
across all scalar values; there is no per-unread-value reader, outcome, or
ordered snapshot.

The standalone `collection-index.memory-diagnostic.ts` measures this cost after
GC. A local Bun run at 20,000 rows measured approximately 7.45 MB added heap
with two distinct scalars and 8.83 MB with 20,000 distinct scalars. These
advisory numbers include activated ordered membership, row-key mappings and
membership groups; they are not a machine-independent memory threshold. Exact
allocation and work counters are the regression gate.

The differential test runs 5,000 transactions across six scopes and three
buckets, with 90,000 committed comparisons and 5,000 scratch comparisons.
Intentional rollback uses a distinct error identity, so failures cannot be
mistaken for expected aborts.

## Reviewed package certification

Three byte-identical pinned-toolchain builds produced runtime digest
`07764fc00a1430582771846a8dd029661dc13bdf5967ec12125e8c3e55bbe3f8`. The hard
digest assertion, exact feature budgets, immutable ordinary baselines, and
damaged/oversized-package self-tests remain enforced.

| Compressed bytes                       | Prior reviewed budget | Indexed implementation |
| -------------------------------------- | --------------------: | ---------------------: |
| Distribution, production + development |                80,164 |                 89,058 |
| Packed package                         |               103,018 |                111,898 |
| Collection consumer                    |                26,245 |                 27,575 |
| All root exports                       |                27,325 |                 28,706 |
| Inspection consumer                    |                26,047 |                 26,313 |
| Query consumer, production             |           New fixture |                 29,466 |
| Query consumer, development            |           New fixture |                 29,466 |

The distribution increase includes both query entrypoints and shared incremental
membership support. Collection-only bundles still exclude the query engine;
ordinary Atom/Selector/Store/family/equality fixtures retain their original
baselines and existing allowances. Production and development query fixtures
execute the same indexed collection/readable query topology. The minor Changeset
announces the new public API without changing package versions.

## Targeted correctness repairs

Materialization now records exactly one event; independent positive assertions
cover initial rows, extractors, groups, reader buckets and snapshot rows. Schema
7 is unchanged. Index schemas require finite, required string names with scalar
values, including named interfaces; optional keys, numeric/symbol names and
index signatures reject. The rollback lifecycle test rethrows any error other
than its own abort sentinel, including failed assertions.

Scratch memo revisions are allocated lazily per queried collection and advance
on every accepted row intent, including value-only and ownership changes. This
is conservative across scopes of the same collection, but unrelated atom and
collection writes no longer invalidate snapshots. The 1,000-row probe with ten
unrelated atom writes/readbacks falls from 11,000 extractor calls to 1,000;
scoped overrides, resets, value updates and rollback remain covered.
