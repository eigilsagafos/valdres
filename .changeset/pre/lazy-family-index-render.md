---
"valdres": patch
---

Make direct (non-transaction) `atomFamily` membership changes scale linearly.
Every `store.set(family(id), …)` on a NEW member — and every `store.del(member)`
— rebuilt and re-sorted the family's entire membership snapshot, so the cost of
adding member K was proportional to the K-1 already there. A loop of 4,000
direct creates took ~1.1s (~540× the same work in one transaction) and grew
~O(K² log K).

The direct path now defers rendering the same way a transaction always has: a
membership write publishes the live index and materializes the sorted, frozen
array at the first observation boundary — a read of the family through
`store.get`, a selector, or dehydration. Deleting a member also drops its
creation entry instead of shadowing it with a tombstone, so a render walks one
entry per deleted member instead of two; the tombstone stays (it masks an
inherited member and stops a read from resurrecting it), so a render remains
proportional to live members plus everything the index has ever deleted.

Measured with the same benchmark on both sides: direct set of 500 new members
15.0ms → 312µs (~48×), and a direct create-then-delete cycle of 500 members
34.5ms → 403µs (~86×) — both now in the same range as Jotai's nearest
equivalents (280µs / 347µs), where they were 50× behind. Transaction throughput,
atom/selector read and write paths, and membership semantics are unchanged.
