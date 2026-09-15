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

## beta.36 ShiftX adoption report and the encoder-frame allocation cut

ShiftX benchmarked `family()` on beta.36 at their real call shapes (~510
definitions reached as `atom(ref: string, context: string[])`, tens of
thousands of accesses per gesture, 4x CPU throttle) against the hand-rolled
`Map` shim it would replace. Identity semantics matched exactly; the finding
was a performance adoption gap. `encodeKey`-based lookup cost ~33ms of
`encodeKey` time plus ~18ms in `getOrCreateOne`, versus ~32ms total for their
own encode + `Map.get`. The single-key and positional-tuple paths bypass the
encoder quarantine on a cache hit and were not the problem.

Root cause: every `encodeKey` invocation, hit or miss, runs through the
definition-callback quarantine (`runDefinitionCallback`), which allocated a
`WeakSet` and mapped an array of selector-session read guards on every call
even though neither is ever populated outside factory construction or an
active selector session.

The fix removes exactly those two allocations, justified by the existing
`allowDefinitions` invariant rather than by counting callers, because the
frame is shared with `collection()`'s encoder phase:

- `DefinitionCallbackFrame.definitions` is allocated only when
  `allowDefinitions` is true (`phase === "factory"`). Every other phase is
  rejected by `assertRuntimeDefinitionConstructionAllowed` before the single
  call site that adds to the set (`registerRuntimeStateHandle`) is reached.
- The read-guard bookkeeping reuses a shared frozen empty array when there is
  no active selector session to guard.

Selector-cycle detection, topology proofs, and `runGuardedCallback` are
untouched; the residual encoder cost sits in the shared capability boundary
and is out of scope for the family lane.

Measured against clean `main` (post collection beta.37 staging) with the
production dist on both engines, fresh process per run, rotating order, 24
rounds each, with two untouched lanes (positional-tuple hit and a bare `Map`
encode+get) as null controls, then cross-checked by a 60-round in-process
interleave and a V8 minor-GC count per million calls:

| lane | Bun/JSC fresh | Node/V8 fresh | Node in-process | V8 GCs per 1M calls |
| --- | --- | --- | --- | --- |
| `family(encodeKey)` hit | -3% (13/24) | -5 to -7% (18-19/24) | -4.6% ±0.5 (54/60) | 697 → 518 |
| `collection(encodeKey)` hit | -5% (13/24) | -12% (17-19/24) | -7.9% ±0.6 (59/60) | n/a |
| null lanes | ±4% | ±5% | ±2% | unchanged |

Removing only the `WeakSet` recovers roughly half of the Node win and nothing
measurable on Bun, so the shipped change keeps both allocation cuts. The win
is modest and does not close ShiftX's gap on its own; it is the whole of what
the family lane can do without touching the shared kernel.

Size: the ordinary `family` fixture grows by 22 gzip bytes (18968 → 18990 on
pinned Bun 1.4.0). Clean `main` already sat 7 bytes under that fixture's
immutable 2% ceiling plus the COL-008 62-byte allowance, so this release
raises the reviewed core-retaining allowance to 77, the new exact no-cushion
maximum overage across the core-retaining fixtures, and moves the packed,
`all-exports`, and `inspect` feature budgets to the measured values. The
immutable ordinary baselines are not regenerated. Three byte-identical
pinned-Bun builds certify the runtime digest.

`test/performance/family.bench.ts` tracks the three `family()` hot paths
against a hand-rolled `Map` reference via `compare()` so the reference side is
excluded from the PR gate like every other benchmark's.

A pre-built keys array to avoid per-call allocation was reviewed for the same
report and not implemented: it is only semantically safe for the
non-`encodeKey` shape, and the GC cost ShiftX observed there is most likely
their own call-site allocation. `members()`/`subFamily()` enumeration stays
out of scope for `family()` by design; ShiftX's enumerated families are
collection()-shaped.
