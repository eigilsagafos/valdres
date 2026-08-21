---
"valdres": patch
---

Fix `writeAtoms` so an equal-value transaction write is a true no-op on a
root store: it no longer overwrites the stored reference with the new
(deep-equal) value, and no longer bumps the tree revision or invalidates
cold selector caches. The scope-shadow pinning behavior on scoped stores is
unchanged.
