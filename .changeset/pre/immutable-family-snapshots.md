---
"valdres": patch
---

Return atom-family membership as cached, frozen, readonly snapshots and keep
internal index metadata non-enumerable, preventing callers from corrupting later
family reads.
