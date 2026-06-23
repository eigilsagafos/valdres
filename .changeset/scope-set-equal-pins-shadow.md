---
"valdres": patch
---

Fix `scope.set(atom, value)` silently failing to pin when `value` equals the
value the scope currently inherits from its parent.

A scope atom that hasn't been written yet is read through to a parent, so
`setAtom` computed `currentValue` from that inherited value. When the new value
was equal, it short-circuited (`if (areEqual) return`) *before* establishing the
scope's own shadow — so the scope kept tracking the parent. A later parent write
to that atom then leaked into the scope, silently dropping the explicit override
(and a delegating subscription never re-rooted). The documented contract is the
opposite: once a scope writes an atom it is isolated, and subsequent parent
writes must not reach it.

Concretely, this was wrong:

```ts
const a = atom(2)            // default 2
const child = root.scope("draft")
child.set(a, 2)              // equals the inherited default → no shadow created
root.set(a, 11)
child.get(a)                 // returned 11; now correctly returns 2
```

The cross-scope/transaction commit path (`writeAtoms`) already pinned equal
values; only the individual `set()` path (`setAtom`) was missing it. The fix
mirrors that branch: on a scope, an equal-valued set of a not-yet-shadowed atom
now calls `setValueInData` to establish the shadow (registering it in
`scopeValueIndex` and re-rooting delegating subscriptions) while skipping
propagation, since the visible value is unchanged. On a root store, or when the
scope already shadows the atom, the equal-value set remains a true no-op, so the
write hot path is untouched.
