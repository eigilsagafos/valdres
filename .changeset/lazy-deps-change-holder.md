---
"valdres": patch
---

Reduce per-dirty-selector allocations during propagation. `reEvaluteSelector`
previously allocated two empty `Set<State>` plus a 5-tuple for every dirty
selector — both Sets stayed empty in the steady-state case (same deps
re-evaluated). They're now nested under a single `DepsChange` holder reused
across each propagation loop (the linear first sweep and the topological
settle); `evaluateSelector` only allocates the inner Sets when a dep is
actually added or removed. Also drops the unused `didEvalCrash` / `error`
return slots. Small (low single-digit percent) speedup on propagation-heavy
workloads; primarily a cleanup.
