---
"valdres": patch
---

Prevent pending async selectors from recreating cache entries and dependency
edges after their last subscriber unmounts. Queued orphan cleanup now revokes
the evaluation while preserving the existing signal contract, and stale Promise
resolution and suspension retries are ignored by the store.
