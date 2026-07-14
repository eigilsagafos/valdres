---
"valdres": patch
---

Make subscription teardown linear across shared selector graphs. Ordinary DAGs
now skip cycle scans through a conservative closure marker, while orphaned
selector cache and reverse-edge cleanup is batched once per microtask with
shared visit state. Liveness reconciliation and `onUnmount` callbacks remain
synchronous.
