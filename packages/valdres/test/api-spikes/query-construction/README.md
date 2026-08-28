# V1 query-construction API spike

This is compile-only Phase 0 evidence. It does not import or modify the legacy
Valdres runtime and it is not a stable API declaration.

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

Packed reachability remains a separate experiment: a compile-only model cannot
prove whether an attached method pulls query runtime code into a membership-only
collection bundle.

No choice is frozen until the type gate, editor snapshots, call-site metrics,
and packed reachability experiment are reviewed together.
