---
"valdres": patch
---

Align the `Store` type contract with runtime behavior: `store.set()` now types
its existing return value, while callback-form `scope()` exposes a borrowed
store without a `detach()` lease. Correct subscription and transaction examples
across the documentation.
