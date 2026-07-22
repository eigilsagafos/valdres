---
"valdres": patch
---

Cross-scope transaction commits now execute one tree-level CommitPlan that
settles each affected store exactly once against the union of its own writes,
inherited changes, and any folded global-peer updates. Observable deltas: a
selector spanning several scopes evaluates once per store per commit instead of
once per reaching pass (an async spanning selector creates one promise per
commit instead of two); a custom `equal` receives the same per-reaching-pass
trigger sets as before — consulted in reaching order for exactly the groups
whose dirty chain reached that selector — so an impure predicate counting calls
sees fewer of them; a global peer that is itself part of the transaction's
store tree settles once instead of once in the peer pass and again in the tree;
and an unset-report failure during a cross-scope commit records into
first-error commit arbitration (and no longer starves other stores'
settlement) instead of escaping raw. Subscriber delivery order, first-error
arbitration, and onChange payload order keep their historical per-reaching-
group causal positions.
