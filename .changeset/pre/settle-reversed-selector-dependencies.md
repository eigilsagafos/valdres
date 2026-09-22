---
"valdres": patch
---

Settle selectors correctly when a mutation reverses dynamic dependencies, so
subscribers receive current values without stale results or false cycle errors.
Propagate genuine selector errors to affected downstream subscribers as well.
