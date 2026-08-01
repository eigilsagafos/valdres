---
"valdres": patch
---

Single-store transactions that mix ordinary writes with `del` / `unset` now
settle through the same commit forest as cross-scope and global-peer commits.
Previously they ran up to three sequential passes over the same store — update,
then delete, then unset — so a selector reached by more than one of them was
evaluated once per pass. The store is now visited once against the union of its
trigger groups.

Three observable behaviors are corrected as a result:

- **A throwing unset report no longer starves the rest of the commit.** Filling
  an `unset` change record can evaluate user code (a scope reads through to a
  de-materialized parent's lazy default). That report now runs inside the
  settlement walk's reporting phase, so a throw is recorded into the commit's
  error arbitration instead of escaping: selector settlement, subscriber
  delivery, `onChange`, and scope re-delegation all still complete, and the
  first error captured by the commit is the one rethrown. Previously the throw
  skipped the shared deferred notification — subscribers never fired for writes
  that `onChange` had already reported — and left a scope with a dropped parent
  delegate, silently ignoring later parent writes.

- **A mixed update + family delete reports its selector's final value once.**
  The spanning selector is evaluated a single time, on fully-applied state, and
  reported from the trigger group that first reached it. Record content and
  order are unchanged (atoms, then the selectors that group reached, in group
  order); only the redundant re-evaluation is gone.

- **A scoped transaction's `unset` reports its recomputed selectors.** The
  parent value is now materialized by the selector's own read-through during
  settlement rather than by a pre-settlement report pass, so a selector that
  genuinely changed is emitted as part of the commit instead of being consumed
  by a silent parent cascade.

`store.unset()` is not a transaction and is unchanged.
