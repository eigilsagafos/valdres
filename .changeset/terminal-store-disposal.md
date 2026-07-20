---
"valdres": patch
---

Make `store.dispose()` terminal and comprehensive. Disposal now drains ordinary
and delegated subscriptions, mounts and timers, change and commit listeners,
pending batches, async selector work, descendant scopes, and global atom
registrations while balancing shared lifecycle counters. Later operations throw
`StoreDisposedError`, and stale cleanup handles remain idempotent.
