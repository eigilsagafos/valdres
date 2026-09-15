---
"valdres": patch
---

Reduce per-access overhead on `family()`'s `encodeKey` hot path. An encoder
frame no longer allocates a `WeakSet` it can structurally never use, and the
per-call selector-session read-guard bookkeeping skips its array allocation
when there is no active selector session to guard against — the common case
for a family accessor called from ordinary application code.
