---
"valdres": patch
---

Fix `store.get()` on a deleted family member returning the default-value factory
function instead of its resolved value. After `store.del(member)`, reading the
member hit the deleted-in-family-index branch in `getState`, which returned the
atom's raw `defaultValue`. For a family created with a function default
(`atomFamily((id) => 0)`), member `defaultValue` is the factory itself, so the
read yielded `[Function]` rather than `0` — and a selector reading it
(`get(member) * 2`) produced `NaN`.

The deleted-member read path now resolves the default the same way a fresh init
does (run a function default, evaluate a selector default, otherwise return the
plain value) via a new side-effect-free `resolveAtomDefaultValue` helper, without
resurrecting the member in the family index.
