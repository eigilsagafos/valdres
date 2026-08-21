---
"valdres": patch
---

Fix: setting a no-default ("suspense") atom inside a transaction now resolves
the pending-default placeholder promise, matching plain `store.set`. Previously
the transaction write path (`writeAtoms`) wrote the value but never called
`resolvePendingDefault`, so a reader suspended on the placeholder hung forever
even though the value was set — same intent as `set`, silently different result.

`resolvePendingDefault` is extracted from `setAtom` into `lib/` so every write
path can share it. The new call in `writeAtoms` is gated on the prior value
being a promise (a placeholder is always stored as one), so the common
non-promise transaction write skips the scope-chain walk and the
benchmark-gated txn hot path is unaffected.
