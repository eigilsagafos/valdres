# V1 query-construction API spike

This is isolated Phase 0 evidence. It does not import or modify the legacy
Valdres runtime and it is not a stable API declaration. The type/editor spike is
paired with a synthetic, preserved-ESM package so API reachability is tested
against the intended v1 artifact shape rather than today's prebundled package.

The spike compares two independent choices:

1. ownership: standalone `query(collection, definition)` versus attached
   `collection.query(definition)`;
2. zero-operator-import grammar: a query-local typed builder callback (A) versus
   a recursively typed object grammar (C).

The four candidates cover matched positive fixtures plus grammar-appropriate
negative and type probes:

- one exact filter;
- filter + range + ordering + facets;
- nested Boolean composition;
- two constraints on the same ordered index;
- reusable fragments;
- a parameterized `family` query;
- negative value/operator/order assertions, including empty, multi-operator,
  explicit-`undefined`, and multi-index shapes;
- closed top-level definition fields, typed builder index/operator members, and
  recursively closed object-grammar index/operator/order/facet and facet-option
  keys;
- structural index-map compatibility: builder terms and reusable object
  fragments reject incompatible maps while remaining portable across separately
  named maps with the same shape (this experiment does not claim nominal
  collection-instance provenance);
- a future heterogeneous multi-collection source map whose `source` discriminant
  narrows its row type.

Run the objective type and editor gates from the repository root:

```sh
bun run --cwd packages/valdres spike:query
```

The checked-in editor snapshot captures normalized completion and hover output
from the repository's TypeScript version. Refresh it only after reviewing a
compiler upgrade or an intentional candidate change:

```sh
bun packages/valdres/test/api-spikes/query-construction/check-editor.ts --update
bun packages/valdres/test/api-spikes/query-construction/check-metrics.ts --update
bun packages/valdres/test/api-spikes/query-construction/check-reachability.ts --update
```

The metrics snapshot uses the TypeScript scanner and AST to enforce 2×2 case
parity, count call-site tokens/syntax, include declaration plus use-site cost
for reusable fragments, and prove that all four candidates use zero imported
query operators. Character counts normalize the experimental
constructor/collection names to the proposed `query` and `movies` spellings so
labels do not bias the comparison.

The concept metric is an explicit review rubric rather than an inferred quality
score. Every candidate records its ownership concept, grammar concept, and the
feature concepts exercised by that case. Reusable-fragment totals also include
the support concepts needed to declare those fragments. The snapshot exposes
those lists for review and deliberately does not assign a winner.

The packed reachability gate packs one test-only fixture package exactly once
and consumes that artifact through Bun, esbuild, Vite/Rollup, webpack, and
native Node/Bun ESM. It compares membership-only and query-using consumers for
all four ownership/grammar candidates, plus focused filterless-query parity and
object order-array cases. Sentinels and retained-module graphs must agree; the
first baseline bundle for every tool/case is executed; two clean builds must
have identical hashes; and a 4 KB engine-sentinel mutation proves the affected
bundle evidence turns red. Bun 1.4 has no module metafile, so its bundled
reachability proof uses output markers, hashes, runtime behavior, and the
mutation control while the other bundlers also assert their module graphs.
Native Node records an exact load trace; native Bun is a behavioral parity smoke
because it exposes no equivalent trace here.

The executable engine is an observable reachability control, not a reference
implementation of production `State`, row-handle, ordering, or facet semantics.
Its runtime assertions cover callback construction, the representative query,
filterless definitions, and object order-array normalization so dead or broken
fixture code cannot masquerade as useful bundle evidence.

The checked-in result favors standalone ownership for the stable primitive:

- standalone membership consumers retain no query engine or grammar module in
  all four bundlers;
- when the collection escapes, the tested eager own-property `.query` closure
  retains the query tier and costs 981–1,163 gzip bytes in this deliberately
  small fixture;
- once a query is used, object grammar is 11–96 gzip bytes smaller than the
  builder grammar in this fixture, which is not enough evidence to choose the
  grammar or predict complete production validation/normalization cost;
- the native Node ESM trace links either variant entry's statically referenced
  query modules; only the narrow `./collection` export provides a hard no-query
  boundary.

These are directional reachability measurements, not production Valdres byte
budgets or proof that every possible attached implementation has the same cost.
The attached cases model an eager own property closing over the query function;
they do not evaluate prototype, lazy, dynamic-import, or opt-in decorator
designs. The gzip deltas are isolated single-entry bundles with no shared chunks
or pre-existing query import, not marginal application costs after the query
tier is already reachable. The evidence supports `query(collection, definition)`
as the underlying API.

Maintainer review selected the recursively typed object grammar for stable
single-collection structural queries: it keeps operator imports at zero, uses
fewer call-site tokens in the matched fixtures, introduces no public callback
capability boundary, and matches the preferred authoring style. The query-local
builder remains useful evidence for a future experimental multi-collection
search algebra, where fluent alias/join/projection composition may justify the
extra surface; it is not a stable Collection member or callback.
