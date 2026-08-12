---
"valdres": patch
---

Keep synchronous reads fresh across scoped stores when `batchUpdates` is
enabled. Implicit batched transactions now share the explicit transaction tree,
so descendant reads and derived writes see pending ancestor values while
preserving child shadows and deferred notifications. Disposing one scope drops
only that scope's pending branch, and synchronous descendant operations flush
the ancestor batch before running.
