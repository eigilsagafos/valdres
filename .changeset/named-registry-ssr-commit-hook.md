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
load those modules before hydrating). hydrate composes with schema validation:
when the hydrating store (or an atom) enables `schemaValidation`, every payload
entry is validated against its atom's `schema` as it stages — by default a
failure throws `SchemaValidationError` and aborts the whole hydration
atomically; `hydrate(store, payload, { invalid: "skip" })` instead warns and
drops just the failing entries.

Atoms with a bidirectional schema (zod 4 — meaningfully `z.codec`) are
**wire-encoded**: `dehydrate` runs the schema's encode direction to produce
the JSON-safe value (BigInt → string, Date → ISO string, nested codecs
included) and marks the entry; `hydrate` runs decode to restore the runtime
value. JS-native values cross a plain-JSON wire with no custom serializer —
give the atom a codec schema and it just works. Decode failures route through
the same `invalid` policy; a one-way transform schema can't encode and falls
back to the raw value with a dev warning; classic `parse`-only and
Standard-Schema-only validators transfer raw values as before. To support
codecs under validation, `validateSchema` now also accepts a value when the
schema's encode direction validates it (a stored value is output-side; `parse`
checks the wire side) — purely additive over the previous behavior.

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
