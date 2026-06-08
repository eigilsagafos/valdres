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
plain value) via a new side-effect-free `resolveAtomDefaultValue` helper, and
caches the resolved default so repeated reads are stable (same reference) and
never re-invoke a function/async factory — re-running it on every read would
repeat its side effects (e.g. a `fetch`). For an async default the cached promise
is swapped for its resolved value once it settles (mirroring `getAtomInitValue`),
so later reads return the value rather than a forever-pending promise. The member
still stays absent from `get(family)`; only its direct read is memoized.
