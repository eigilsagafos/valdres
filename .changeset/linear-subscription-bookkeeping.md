---
"valdres": patch
---

Maintain exported subscription equality metadata with an O(1) reference count
so tearing down many subscriptions to the same state is linear instead of
quadratic.
