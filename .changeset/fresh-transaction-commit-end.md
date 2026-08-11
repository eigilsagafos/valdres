---
"valdres": patch
---

Fix `store.onCommitEnd` delivery for transactions that initialize a large batch
of fresh, otherwise unobserved atoms. These commits now report their completed
work even when run without another global store listener already active.
