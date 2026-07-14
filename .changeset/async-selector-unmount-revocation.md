---
"valdres": patch
---

Prevent pending async selectors from recreating cache entries and dependency
edges after their last subscriber unmounts. Queued orphan cleanup now revokes
the evaluation and aborts its allocated signal, while stale Promise resolution
and suspension retries are ignored by the store.
