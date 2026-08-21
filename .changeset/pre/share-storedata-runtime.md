---
"valdres": patch
---

Share one internal runtime across every store facade backed by the same
`StoreData`. Scope handles now act as lightweight detach leases over shared
operations, so batched functional updates compose correctly, synchronous
operations flush the common pending transaction, subscriber notifications
coalesce once per microtask, and `onMount` writes participate in the same batch.
