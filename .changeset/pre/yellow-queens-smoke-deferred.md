---
"@valdres-react/jotai": patch
---

Make `store.txn` own its complete atomic lifecycle. Transaction callbacks now
receive a restricted, type-only `Transaction` surface with no manual `commit()`
or backing `data`; a thrown callback always discards staged writes. Captured
operations reject use while the transaction is committing or after it closes.

Move manually controlled transactions to the explicit
`valdres/adapter-internals` boundary, and update the Jotai compatibility adapter
to use that boundary while preserving its adapter-specific commit-on-error
semantics.
