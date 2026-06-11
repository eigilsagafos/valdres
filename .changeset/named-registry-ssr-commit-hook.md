---
"valdres": minor
---

Core prerequisites for the 1.0 adapter rework: a named-state registry with
serializable SSR state transfer, a commit-boundary hook, and the shared
adapter-initialization contract.

**Named-atom registry + `dehydrate`/`hydrate` (SSR state transfer).** Atoms and
atomFamilies created with a `name` now auto-register in a global registry on
the `globalThis.__valdres__` single-instance slot. Names are global addresses:
creating a second atom or family under an already-registered name throws
(namespace them like `"@valdres/<pkg>/<atom>"`). An atomFamily registers the
FAMILY under its name — members never register individually and are addressed
as `family(...args)`; global families keep their idempotent same-name →
same-instance behavior; selectors never register. `dehydrate(store)` walks the
registry (not the store) and returns a JSON-serializable
`{ atoms: [name, value][], families: [name, args, value][] }` payload holding
only state with an own value in that store (root stores only); pending-promise
values are skipped with a dev warning. `hydrate(store, payload)` resolves names
through the registry — family entries via `family(...args)` — and applies
everything in one `store.txn`; unknown names warn and are skipped (an atom only
registers when its defining module was imported, so code-split clients must
load those modules before hydrating).

**`store.onCommitEnd(callback)`.** Subscribe to commit boundaries: fires
exactly once per commit (set/reset/del/unset, async resolution, `store.txn`,
batched flush), strictly after every subscriber callback and after
`store.onChange`, and returns an unsubscribe function. No payload by design —
it is the minimal signal an adapter needs to coalesce one commit's subscriber
updates into a single framework batch. Listeners attach to the store TREE's
root: a commit anywhere in the tree (root or any scope) fires them, and writes
performed by subscribers during a commit fold into the outermost commit's
single fire. With no listener registered, commits pay one counter read — no
tracking, no allocation.

**Shared `InitializeCallback` + `setAtomPairs`.** The
`(txn: TransactionInterface) => void | [Atom<any>, any][]` initialization
callback every adapter accepts is now defined and exported by core, alongside
`setAtomPairs(set, pairs)` which applies returned pairs through `txn.set`.
`Transaction.reset` is now generic, making `Transaction` structurally
assignable to `TransactionInterface` (kills the adapters' `@ts-ignore`).

**Breaking (pre-1.0):** duplicate names throw as described above, and the
`globalThis.__valdres__` slot changed from a bare version string to
`{ version, registry }` (the single-instance guard behaves as before, and a
leftover string slot from an older build is still detected).
