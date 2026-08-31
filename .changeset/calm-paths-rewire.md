---
"valdres": patch
---

Speed up dynamic selector rewiring by excluding terminal source nodes from
cycle-path searches. Large graph-changing transactions now avoid repeatedly
walking atom leaves while preserving the same cycle errors, notifications, and
committed values.
