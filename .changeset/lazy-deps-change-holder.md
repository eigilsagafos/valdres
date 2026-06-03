---
"valdres": patch
---

Internal cleanup: reduce allocations during selector propagation. Re-evaluating
a dirty selector previously allocated two empty tracking Sets (for added/removed
dependencies) on every pass, even though both stay empty in the common case
where a selector's dependencies don't change. Those Sets are now allocated
lazily — only when a dependency is actually added or removed — and the tracking
state is reused across each propagation pass. Measures ~2–5% faster on
allocation-heavy propagation microbenchmarks (within noise on the largest
fan-outs); no behavior change.
