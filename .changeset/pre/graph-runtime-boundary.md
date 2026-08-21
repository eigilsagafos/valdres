---
"valdres": patch
---

Move every write to the dependency-graph tables behind an internal
GraphRuntime boundary (`src/lib/graph/`): forward/reverse edges and
dependency replacement, scope-branch registration, liveness counters and
mount reachability, cycle metadata, orphan-edge cleanup, and the
installation of dependencies discovered by async evaluation. Selector
evaluators no longer mutate graph state — they report discovered
dependencies through a pooled evaluation-outcome carrier and the dispatcher
that ran them installs the result, so evaluation and graph bookkeeping are
now separable phases with documented invariants at each boundary.

Internal-only: no public API, semantics, or ordering changes. The core
write-path import cycle shrinks from 24 modules to 9 and the
`mountAtom ↔ storeFromStoreData` cycle is gone, guarded by a new
type-checker-based table-ownership scan and stricter import-boundary tests
alongside the existing cycle ratchet.
