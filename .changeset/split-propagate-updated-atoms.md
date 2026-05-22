---
"valdres": patch
---

Refactor `propagateUpdatedAtoms` into two purpose-built functions:
`propagateAtomUpdate` for top-level updates (collect direct subscribers,
walk dependent selectors, cross into scopes) and `propagateInScope` for
scope-level recursion (selector walk + scope recursion only, since the
parent scope already notified atom subscribers and family-index updates
have already cascaded). Drops three dead parameters (`isRecursive`,
externally-passed `subscriptions` and `families`) and the `selectorsOnly`
boolean — these are now encoded by which function the caller chooses.
Pure refactor: no behavior change, full test suite green, benchmarks
unchanged.
