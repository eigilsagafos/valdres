---
"valdres": patch
---

Fix a `liveDependentCount` desync that could leave a selector permanently
non-live — and therefore returning a stale value — even though a live
subscriber still transitively reads it.

During a selector-update propagation the topological scheduler can re-evaluate a
selector more than once with transitional (non-final) dependency sets (a
selector that is both in the initial dirty set and downstream of another, plus
escaped/stranded re-evals). When a still-live selector *transiently* dropped a
dependency, the eager liveness bookkeeping ran `propagateNotLive` and tore down
the `liveDependentCount` of an entire transitive subtree; when the dependency
was re-added later in the same pass, the `isLive(selector)` guard was now false
(the selector itself had been caught in that teardown), so the compensating
`onLiveDependencyAdded` was skipped and the subtree was left with
`liveDependentCount === undefined`. `propagateDirtySelectors` then skipped it on
every later write, so it never recomputed and served its cached value forever.

This surfaced in apps that drive a stable subscribed root selector over a
dynamic, data-dependent selector graph and rewrite many atoms in one
transaction (e.g. a time-travel/scrub feature that collapses a layout to empty
and grows it back): after the round trip, deep changes stopped propagating to
the root until an unrelated change re-rooted the graph. It is the liveness
analog of the beta.4 escaped/stranded *value*-staleness regression — the value
path was hardened in beta.5, but the liveness bookkeeping was not.

The fix re-derives `liveDependentCount` from ground truth for exactly the
affected region (the downward dependency closure of the deps removed during the
pass) after propagation settles, robust to any intermediate re-evaluation order
and to cycles (recursive `selectorFamily` members). It is gated on a dependency
actually being removed from a live selector during the pass, so the
steady-state propagation path is unchanged.
