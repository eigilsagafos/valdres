---
"valdres": patch
---

Keep async selector dependency reconciliation isolated per evaluation when
multiple selectors or stores return the same Promise. Dependency data now lives
on the existing evaluation context instead of a Promise-keyed global WeakMap,
preventing one resolution handler from removing another evaluation's real edge
while also reducing async tracking overhead.
