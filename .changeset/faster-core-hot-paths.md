---
"valdres": patch
---

Improve core write, propagation, store, and family-key hot paths. Commit plans
now share one complete object shape, scheduler metadata uses bitwise decoding,
root and scoped stores initialize one stable set of fields, and primitive family
keys avoid allocating a cycle guard.
