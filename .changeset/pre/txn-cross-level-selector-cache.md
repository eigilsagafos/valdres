---
"valdres": patch
---

Fix stale selector reads across transaction levels. A scoped transaction
evaluates selectors through its parent's draft, but a write only marked its own
level's cache dirty — so a root-level `set` left a scope (and a `parentScope`
write left the scope that opened it) serving the pre-write value for the rest of
the transaction. Writes now invalidate every selector cache in the working tree.
