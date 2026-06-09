---
"valdres": patch
---
Fix two scope × atom-family × transaction propagation-soundness bugs found by a
differential soundness fuzzer.

1. A parent family-member add never recomputed a scope's selectors that read
   `get(family)`. `propagateAtomUpdate` propagated only the changed member atoms
   into scopes, not the family object the selectors actually depend on — so the
   scope's `get(family)` membership refreshed but the dependent selector/`index()`
   stayed stale. The add path now propagates the changed families into scopes,
   mirroring the delete path. (Reproduces with a plain `set`, no transaction.)

2. A scope whose family index was first materialized inside a transaction was
   severed from its parent index. `Transaction.cloneFamilyIntoTxn` flat-cloned the
   parent's rendered index into the scope's own `created` map and never registered
   the scope in `scopeValueIndex`, so later parent member adds never appeared in
   the scope and parent deletes never removed the inherited member. It now builds a
   proper child index (`createAtomFamilyIndex(parentIndex)`) and registers via
   `trackScopeValue`, exactly like the non-transaction `initFamilyIndex` path.

The transaction family-index path now reuses the non-transaction
`initFamilyIndex` chain walk (via a shared `ensureFamilyAncestorChain` run at
commit) instead of authoring a flat index that could skip intermediate scopes.
This consolidation also fixes a deeper-nesting case: a grandchild scope that
first materialized its family index inside a scope-only transaction is now wired
into the full ancestor `scopeValueIndex` chain, so later parent membership
changes reach it.

The core topological selector engine (`propagateDownstreamTopo` + liveness
counting) was exercised by the same fuzzer across 30k+ random acyclic graphs with
dynamic dependencies, scopes, and batched/cross-scope transactions with no
soundness violations.
