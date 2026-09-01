---
"valdres": minor
---

Add the experimental `valdres/inspect` flight recorder for bounded structural
Store diagnostics, and allow optional human-readable transaction labels via
`store.txn(callback, name?)`. Ordinary Stores keep the same behavior and do not
load the recorder.
