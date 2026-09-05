# Identity-only `family()`

Status: implementation candidate; ShiftX migration evidence pending.

## Scope

`family(createNode, { encodeKey? })` is a definition factory, not Store state.
It memoizes one Atom or Selector per non-empty ordered primitive tuple. Every
position uses `SameValueZero`; arity, order, primitive type, and Symbol identity
remain significant. Structured arguments require an explicit synchronous
`encodeKey` returning one primitive `FamilyKey`.

The family callable has no membership, enumeration, deletion, release, Store,
scope, transaction, index, or collection surface. Collection semantics remain a
separate lake.

## Ownership and lifecycle

Each family owns a primitive-key tuple trie whose terminal values are weak.
Finalization removes only the exact registered generation and prunes empty
routes. A lookup repairs a dead weak reference synchronously, so correctness
does not depend on finalizer timing.

A successfully committed family Atom override is mirrored by one private strong
pin in that exact Store scope. Reset and explicit scope/Store disposal release
the pin. Equal-value ownership shadows still pin because they create an owned
scope coordinate. Transactions add pins only after successful validation and
commit. Active subscriptions and retained selector dependency snapshots already
provide their existing strong ownership; standalone cold records remain weak.
The pin Set is not family membership and is never enumerable.

The factory must construct its returned State in the active family construction
frame or return any already-published family member. This preserves the promised
weak identity while any Store record retains an Atom without adding a reverse
owner index to every ordinary Atom write.

## Callback boundary

Factories and encoders are synchronous and run under the definition callback
quarantine. Factories may construct immutable State definitions and call family
accessors, including the same family at a different identity. Encoders are pure
canonicalization: Store work, State construction, and calls to any family
reject. Returned or thrown thenables are contained and reject synchronously. A
factory or encoder cannot borrow an active selector-supplied `get`; the first
exact capability fault stays sticky even when user code catches it. A failed,
invalid, recursive, or foreign construction creates no cache entry.

## Alternatives considered

1. **Accept any pre-existing State and reverse-index every Store override.**
   Rejected. It adds work and retention metadata to every ordinary Atom write so
   an uncommon family alias can discover old owners retroactively.
2. **Hold all family members strongly for the family lifetime.** Rejected. It
   leaks high-cardinality context-keyed members and requires a release API that
   would recreate the old family/membership coupling.
3. **Let Store overrides stay weak and recreate a collected family Atom.**
   Rejected. Reacquisition could silently lose the committed value and expose
   the Atom fallback.
4. **Reuse legacy atomFamily/selectorFamily caches.** Rejected. They combine
   identity with structural encoding, membership, enumeration, deletion,
   release, and indexes.
5. **Hide retention metadata inside `atomOverrides` or reuse unrelated Symbol
   slots.** Rejected after measurement. The small byte saving makes ownership
   less explicit without changing the historical size-gate result.
6. **Change every guarded callback to reject a borrowed selector `get`.**
   Deferred. The existing core explicitly supports lazy-initializer re-entry;
   this slice enforces only the new family factory/encoder boundary rather than
   silently changing that established callback behavior.

## Work and package gates

Internal counters freeze retention Set allocation, distinct retains, and
explicit releases. Ordinary Atom writes and cold family reads must leave all
three at zero. The packed atom-only fixture must contain no family cache or
accessor sentinel; only the small Store ownership/quarantine seam is shared.

On pinned Bun 1.4.0, the family seam adds 1,313 raw / 413 gzip bytes to the
atom-only fixture versus a freshly rebuilt beta.35 artifact (+2.07% / +2.51%).
The cache/accessor implementation itself still tree-shakes away; that delta is
the construction quarantine, lifecycle pin, exact work counters, and the
selector-capability guard across every distinct active selector session.
Prototypes that preserved domain/session encapsulation saved at most 32 gzip
bytes; a module-global guard saved 82 gzip bytes but coupled independent
runtime domains and custom evaluators, so it was rejected. Release review
records and ratchets the reproducible delta from the committed size baseline
rather than trading away lifecycle semantics for byte-budget headroom.

Before release, replace one ShiftX identity shim with this API and verify the
same graph shape, values, notifications, and transaction boundaries. The family
beta must remain separate from the cold-drop performance beta so either change
can be rolled back and measured independently.

## beta.36 ShiftX adoption report

ShiftX benchmarked `family()` on beta.36 at their real call shapes (~510
definitions reached as `atom(ref: string, context: string[])`, tens of
thousands of accesses per gesture, 4x CPU throttle) against the hand-rolled
`Map` shim it would replace. Correctness and identity semantics matched
exactly (tuple identity, prefix-vs-longer-tuple distinctness, per-member
independence, structural identity through the non-primitive fallback); the
finding was purely a performance adoption gap, not a defect. They kept the
hand-rolled `Map` and reported two concrete costs at their call shapes:

- `encodeKey`-based lookup cost ~33ms of `encodeKey` time plus ~18ms in
  `getOrCreateOne`, versus ~32ms total for their own hand-rolled encode +
  `Map.get`.
- A positional-tuple attempt (spreading their `context: string[]` into
  distinct positional keys) cut their own encoding cost but the per-access
  allocation and trie walk cost more than the encoding win, with GC alone at
  ~26ms in one trace.

Root-caused with a fresh-process Bun microbenchmark (200k-iteration warmed
loop, matching their `(ref, context)` shape): a plain `Map.get` on an
already-encoded key costs ~2ns; `family()`'s single-key/positional-tuple hot
path (bypassing `encodeKey`) costs ~30-40ns — real but small in absolute
terms even at tens of thousands of calls. The `encodeKey` path, however,
measured ~220ns/call — because every `encodeKey` invocation runs through the
full factory/encoder quarantine (`runDefinitionCallback`), which allocated a
`WeakSet` and mapped an array of active selector-session read-guards on
*every* call, not just on cache misses, regardless of whether either was
ever populated.

Fixed two allocations that the definition-callback quarantine can
structurally never need outside factory construction or an active selector
session: a `DefinitionCallbackFrame`'s `definitions` set is now `undefined`
unless `allowDefinitions` is true (`phase === "factory"`) — every non-factory
phase (`encoder`, `family-encoder`, `collection-encoder`) is rejected by
`assertRuntimeDefinitionConstructionAllowed`/the equivalent inline check
before the one call site that ever adds to that set is reached, so it is
never populated for those phases — and the read-guard bookkeeping reuses a
shared empty array instead of mapping one when there is no active selector
session to guard, the common case for a family accessor called from ordinary
application code. This is phrased in terms of the `allowDefinitions`
invariant rather than "family is the only caller" deliberately: this frame
type is shared with `collection()`'s own encoder phase (added after the
original identity-cache measurement above), so the fix had to be re-derived
against that shared shape, not against a caller count that was already
stale by the time of writing.

Net effect, measured through the repo's own paired `measureOne`/`compare`
benchmark harness (not an ad-hoc timing loop) via manual alternating
before/after rounds on both engines this library ships for: `encodeKey`
cache hit dropped by roughly 5% on Bun/JSC and a comparable amount on
Node/V8 — real and reproducible, but modest, not the double-digit figure an
earlier single-run measurement suggested. The single-key and positional-tuple
paths were already outside `runDefinitionCallback` on a cache hit and are
unchanged. `test/performance/family.bench.ts` tracks all three hot paths
against a hand-rolled-`Map` reference via `compare()` going forward, so the
reference measurement is excluded from the PR gate the same way every other
benchmark's reference side is (`BENCH_VALDRES_ONLY`).

An independent architectural review (a separate, more capable model
reviewing specifically for the kind of uncoordinated shared-infrastructure
optimization this project is trying to avoid — see the kernel-tournament
handoff) caught two real problems before this shipped: the fix was first
written against a since-superseded shape of this frame (an `origin/main`
rebase had already renamed it and added the `collection()` caller above),
and the first version of the benchmark called `measureOne` directly for the
hand-rolled-Map side instead of `compare()`, which would have let a
near-noise-floor `Map.get` measurement enter the paired PR gate as its own
tracked series. Both are fixed above.

The remaining `encodeKey`-path cost sits in `runGuardedCallback`'s
capability-boundary enforcement (shared with every guarded callback in the
domain, not family-specific) and is out of scope for the family() lane.
Closing more of the gap would mean either a wider capability-boundary
redesign or a semantic trade-off (e.g. a genuinely allocation-free lookup
path that gives up the encoder quarantine or the weak-cache identity
guarantee for a narrower fast case) — see the accessor-level pre-built-keys
API considered separately for the no-allocation-key-path request.

`members()`/`subFamily()` enumeration remains out of scope for `family()` by
design; ShiftX's two enumerated families (`mutationAtom`, `entityAtom`) are
collection()-shaped and are expected to move there once L3 ships, per their
own report.
