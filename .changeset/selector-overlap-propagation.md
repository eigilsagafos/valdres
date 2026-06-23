---
"valdres": patch
---

Avoid redundant selector evaluations when an initial dirty selector is also
downstream of another initial dirty selector in the same propagation pass.
The initial dirty set is now ordered topologically when that subgraph is
acyclic, and selectors scheduled later in that initial pass are not queued
again for downstream propagation before they run. Cyclic initial regions keep
the existing insertion-order behavior so dynamic dependency churn continues to
use the established liveness reconciliation path.
