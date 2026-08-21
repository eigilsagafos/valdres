---
"valdres": patch
---

Settle Promise-like atom writes consistently in direct, batched, and explicit
transaction writes. Batched stores now replace the pending Promise with its
validated resolved value, roll back rejected or invalid writes, ignore stale
settlements, and notify subscribed selectors without leaving them in a retry
loop.
