---
"valdres": minor
"valdres-svelte": patch
---

Add `applyInitialize(txn, initialize)` — the single place the adapter
`initialize` contract is interpreted, so every framework adapter handles it
identically.

It runs the callback inside a transaction the caller opened and applies any
returned `[atom, value]` pairs, guarding with `Array.isArray` rather than a
truthiness check. This fixes a latent footgun: a single-expression callback like
`txn => txn.set(atom, 1)` already writes through `txn.set` and *returns that
call's value* (e.g. a number), which the previous `if (pairs) setAtomPairs(...)`
pattern fed back into `setAtomPairs`, throwing "is not iterable". A non-array
return now correctly means "the callback wrote directly; nothing left to apply".

`valdres-svelte`'s `setValdresContext` and `scope` now consume the helper
(replacing the inline `if (pairs)` pattern), so the crash no longer occurs.
`setAtomPairs` remains exported as the low-level primitive; its docs now point
to `applyInitialize` and show the `Array.isArray` guard.
