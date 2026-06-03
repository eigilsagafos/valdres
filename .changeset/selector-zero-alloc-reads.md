---
"valdres": patch
---

`selectorFamily` no longer wraps the user's factory in a per-cache-miss
closure that re-invoked `callback(...args)` on every selector evaluation.
The inner getter is now stored on the selector object directly at
cache-miss time, so each evaluation skips one closure call and one
closure allocation. `sel.get` is also identity-stable across reads,
which keeps downstream identity-based caches honest.
