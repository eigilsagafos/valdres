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

Both grammars cover the same fixtures:

- one exact filter;
- filter + range + ordering + facets;
- nested Boolean composition;
- two constraints on the same ordered index;
- reusable fragments;
- a parameterized `family` query;
- negative value/operator/order assertions, including empty, multi-operator,
  explicit-`undefined`, and multi-index shapes;
- recursively closed definition/index/operator/order/facet and facet-option keys
  plus collection-local provenance for builder terms and reusable object
  fragments;
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
all four ownership/grammar candidates. Sentinels and retained-module graphs must
agree; every bundled output is executed; two clean builds must have identical
hashes; and a 4 KB observable engine mutation proves the gate turns red. Bun 1.4
has no module metafile, so its bundled reachability proof uses output markers,
hashes, runtime behavior, and the mutation control while the other bundlers also
assert their module graphs. Native Node records an exact load trace; native Bun
is a behavioral parity smoke because it exposes no equivalent trace here.

The checked-in result favors standalone ownership for the stable primitive:

- standalone membership consumers retain no query engine or grammar module in
  all four bundlers;
- when the collection escapes, the tested eager own-property `.query` closure
  retains the query tier and costs 918–1,129 gzip bytes in this deliberately
  small fixture;
- once a query is used, object grammar is 68–131 gzip bytes smaller than the
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
as the underlying API while leaving builder callback versus recursive object
grammar open for runtime/editor trials.

No grammar choice is frozen until the type gate, editor snapshots, call-site
metrics, packed reachability evidence, and runtime usability trials are reviewed
together.
