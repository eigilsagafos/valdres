---
"valdres": patch
---

Remove unused equality bookkeeping so tearing down many subscriptions to the
same state is linear instead of quadratic.
