---
"valdres": patch
---

Fix `store.del(familyMember)` (and `txn.del`) not re-evaluating dependent
selectors in descendant scopes. When a family member was made live in both the
root and a child scope — the scope inheriting the member rather than shadowing it
— deleting it at the root fired the root's subscriber and updated the root's
selector, but the child scope's subscriber never fired and its selector stayed
stale.

The delete-time scope cascade only re-evaluated scopes that *shadowed* the family
(keyed on `scopeValueIndex.get(family)`), so it missed two kinds of descendant
dependent: a scope that merely inherits the deleted member and reads it directly
(e.g. `get(family("a"))`), and a non-shadowing scope whose selector reads the
family list (`get(family)`). `propagateDeletedAtoms` now cross-propagates the
deleted member atoms *and* their families through the full scope tree via the
same `propagateToScopes` path the `set`/update flow already uses — members skip
scopes that shadow them (their visible value is unchanged), families always
propagate (their rendered list shrank everywhere) — so descendant-scope
dependents re-evaluate and their subscribers fire, matching the update path.
