# ExternalAtom implementation contract and engineering review

Status: Gate 0 approved with owner amendments; E3.5 repair/extraction and E4 public certification are complete. The broad historical tournament timeout reproduces on clean main; all feature, ordinary isolation, package, and packed-consumer gates pass.
Review target: `.context/attachments/HYMHX1/external-atom-implementation-agent-prompt.md`.
Fetched base: `270f00e46f26aee66a724fcf6d6fdda09ddcf133` (`origin/main`, includes PR #397).
Initial branch: `implement-external-atom`; initial HEAD equals base. No branch rename.
Owner approval authorizes E3.5, followed by E4 once E3.5 is green. No version or changelog bump; no merge.

## Ownership and data flow

```text
structural source (may own a shared physical hub)
  |
  +-- constructor call --> domain-branded ExternalAtom definition
                              |
               +--------------+----------------+
               |                               |
        StoreTree A weak projection     StoreTree B weak projection
        one aggregate retain            independent attachment/settlement
               |
        weak routes to affected scopes
               |
        existing scope selector DAG --> frozen subscriber snapshot
               |
        separate sparse lifecycle retains (never cache ownership)

same definition --> TreeDraft root capture memo (all scopes/generations)
                --> disposable hydration host server memo (no live graph)

projection: dormant -> attaching -> active -> detaching -> dormant
                        |            |           |
                        +------------+-----------+--> disposed

operation frame: work -> instrumentation -> all-fire notification -> cleanup
                                                        |
                idle <- bounded ordered dirty rounds <--+
                terminal round installs recoverable errors; no queued work
```

## Approved Gate 0 decisions

The owner approved items 1–5 with the amendments below on 2026-09-16.
Source citations are to the
fetched base unless an absolute recovery-plan path is given. The recovery plan
is `/Users/eigilsagafos/conductor/workspaces/valdres/amsterdam-v1/.context/valdres-1.0-recovery-plan.md`;
that file and the Amsterdam roadmap will not be edited here.

1. **Named types.** Export exactly `ExternalSource<T>`, `ExternalAtom<T>`, and
   `ExternalAtomOptions` from `valdres`, alongside the factory. Source is the
   readonly structural `{ getSnapshot(): T; getServerSnapshot?(): T;
   subscribe(invalidate: () => void): () => void }`. ExternalAtom is a distinct
   invariant State arm with readonly `kind: "external"`; options contain only
   readonly optional `name?: string`. No additional named callback, projection,
   lifecycle, or scheduling types. Evidence: recovery 657–662; public-api.json
   727–778; target-surface-catalog.json 361–366 and 527–532. The named type
   coordinates and kind literal are not currently frozen.

2. **Invalid synchronous snapshot.** One immutable root class
   `InvalidSynchronousExternalSnapshotError`, code
   `VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT`, for returned or thrown
   thenables in either live or server readers. Fixed message:
   `External source snapshots must be synchronous`. Exactly one stateless
   rejection handler per actual sample; never await. A throwing `then` getter
   remains its exact ordinary error, subject to sticky mismatch precedence.
   Evidence: recovery 2311–2319 and 2446–2452;
   callback-capabilities.json 405–458; the existing Atom boundary convention is
   runtime-domain.ts 251–260 and 313–397. No such class/code is frozen today.

3. **Failure ledger.** Preserve the existing lifecycle-free
   `SubscriberNotificationError` constructor, raw `cause`/frozen `causes`,
   `committed: true`, `phase: "notifying"`, and `source: "owned-mutation"`.
   For external notification settlements widen source to
   `"external-read" | "external-startup" | "external-invalidation" | "external-drain"`.
   Preserve mismatch-first ordering *within* a settlement. Across an outer
   operation, its first failure stays primary; append later failures in
   occurrence order after all delivery, cleanup, and drain work.

   For mixed-phase failures use one additional immutable root class,
   `ExternalSourceOperationError / VALDRES_EXTERNAL_SOURCE_OPERATION`, with
   `cause`, frozen raw `causes`, and frozen `failures` records of
   `{ cause, committed, phase, source }`. Top-level `committed`, `phase`, and
   `source` mirror the primary record, not whether *anything* changed later.
   Phase domain: `"admitting" | "sampling" | "settling" | "notifying" |
   "cleanup" | "instrumenting"`. Source domain: `"owned-mutation" |
   "external-read" | "external-startup" | "external-invalidation" | "external-drain" |
   "external-cleanup"`. No named metadata type export is needed. Fixed message:
   `An external source operation failed`.

   A lone notification failure keeps its SubscriberNotificationError wrapper;
   a lone control fault remains exact. Named lifecycle/bound errors remain
   directly thrown when they are the sole failure, with immutable phase/source/
   committed metadata; when additional failures occur, the operation wrapper
   retains the exact original errors as causes. A lone arbitrary setup/cleanup
   throw uses the operation wrapper so application error objects are never
   mutated. Ordinary sampled snapshot errors are outcomes, not ledger entries.
   The proposed `external-read` source also covers a dormant pull that publishes
   one source before a later source fails; its earlier changes must still settle
   and any subscriber failure remains secondary. This case was added during E1
   review and is included in the approved contract.
   `InvalidExternalCleanupError / VALDRES_INVALID_EXTERNAL_CLEANUP` already
   exists in the contract and covers invalid setup cleanup and returned/thrown
   cleanup thenables. Ordinary synchronous cleanup return values are ignored
   (`() => listeners.delete(callback)` is valid); cleanup promises are rejected.
   It needs no replacement class. Evidence: public-api.json
   1072–1100 and 1188–1214; callback-capabilities.json 477–506 and 538;
   runtime-domain.ts 184–199; recovery 2405–2409, 2460–2475, 2536–2657.

4. **Missing server path.** `ServerSnapshotUnavailableError.dependencyPath`
   has type `readonly State<any>[]`: a frozen readonly array of the exact local
   State handles (State is invariant), ordered from
   requested target through the active dynamic selector reads to the missing
   ExternalAtom, inclusive. A direct read is `[external]`. Preserve the first
   missing path as host-fatal, even if selector code catches it; no live-cache
   path reuse. Freeze the error and array, not application snapshots. Fixed
   message: `An external source has no server snapshot`; names, values, IDs,
   and paths are not interpolated. The class/code stay
   `ServerSnapshotUnavailableError / VALDRES_SERVER_SNAPSHOT_UNAVAILABLE`.
   Evidence: public-api.json 1217–1243; recovery 2273–2278 and 2305–2316.

5. **Identity and validation.** Every constructor call produces a fresh frozen
   branded definition; wrapping the same source twice does not deduplicate.
   The structural source remains unbranded and unfrozen. Accept a non-null
   object with callable `getSnapshot` and `subscribe`; optional
   `getServerSnapshot` must be undefined or callable. Accept inherited methods
   and retain their receiver; capture validated method references at construction.
   Ignore extra source properties. Options must be undefined or a non-null,
   non-array object with no own keys other than `name` (including symbols and
   non-enumerable keys); `name` must be undefined or string. Reject missing/extra
   positional arguments, non-object sources, and malformed methods/options with
   TypeError before registering a definition or calling source methods. Property
   access exceptions stay exact; validation runs under capability quarantine.
   Diagnostic name never participates in identity. Evidence: recovery 954–956;
   public-api.json 753 and 775; runtime-domain.ts 707–745; collection/family
   definition validation provides existing capability patterns.

6. **Internal bounds.** Start with 64 dirty-drain rounds and 4,096 source samples
   per outer campaign; same-domain delivery depth 32 and delivery work 4,096.
   Charge before work, include the initial entered external settlement in work,
   and use test-injected smaller limits to exercise boundary and partial-round
   exhaustion. Terminalize every still-pending live generation, including the
   unsampled round suffix and dirties created during that round. Ignore same-stack
   terminal feedback; retain attachments; a later invalidation starts a fresh
   campaign. A delivery limit marks only the unentered generation retry-required
   and publishes nothing there. Numeric constants are internal, not timing API.
   Evidence: recovery 2561–2596. Counters below freeze the work definition before
   production implementation.

## Public family contradiction resolved by owner approval

`contracts/v1/check.ts:1554–1561` demands `same-domain Atom or Selector` and
emits: `family factory admission must remain Atom-or-Selector after State widens`.
`callback-capabilities.json:279–280` freezes that restriction. Recovery 849–851
instead explicitly includes `family((key) => externalAtom(...))`, as does this
implementation brief. The owner approved narrow widening to Atom, Selector, or
ExternalAtom created in the active factory frame or already published as a family
member. Arbitrary pre-existing States and collection States remain rejected.
Atom-only override retention/reacquisition stays unchanged. E4 applies the
reconciled catalogs and guards together.

## Engineering review

Scope is accepted as specified in the implementation brief: the historical five-slice
implementation already separates the necessary cross-cutting work. Reducing
away lifecycle or hydration would violate the explicitly requested primitive.

### What already exists

- RuntimeDomainRecords owns definitions and capability activities; add the exact
  external arm and callback modes there, retaining ownership-first validation.
- StoreScopeNode owns selector proposals, weak reverse edges, and outcome tokens;
  reuse that evaluator and dependency-directed propagation.
- CommittedStoreTreeHost owns aggregate subscription admission and frozen all-fire
  delivery. Add the phase/ledger there; activity is not settlement state.
- TreeDraft survives scope-local scratch generations; put external capture there.
- ScratchSelectorHost already provides disposable hydration evaluation. Rename
  its collection `ext` lane to `collection` before adding `external`.
- `useValue.ts:16` and `inspect.tsx:789` duplicate the third-getter cache. Their current
  `assertStore` only validates ownership, so cached outcomes need a liveness seam.

### Architecture and code quality findings

- [P1, confidence 10/10] A scope scratch source memo is cleared on generation
  advance (`scratch-selector-host.ts:94–101`); it cannot implement transaction
  capture. Use a lazy TreeDraft root memo and a distinct server-host memo.
- [P1, confidence 10/10] `sub` currently admits callbacks directly, and
  `#deliverSubscriptionSnapshot` throws immediately after delivery. Introduce
  provisional registration and an outer error ledger before attaching sources.
  Otherwise startup callback failure leaks an unreachable registration and a
  notification failure can starve dirty drains. The brief already requires this.
- [P1, confidence 10/10] Lifecycle changes must propagate despite comparator-equal
  selector results. Store immutable closure metadata separately from outcome
  token propagation and retain new branches before releasing old ones.
- [P1, confidence 10/10] Both React hydration closures return cached results after
  an owner-only assertion. Add liveness validation without sampling live state.

### Test coverage and failure map

```text
constructor -> exact identity / invalid inputs / domain ownership       E1/E4
read -> dormant unchanged/changed/dynamic -> one existing DAG settle   E0/E1
     -> retained O(1), ordinary errors, thenables, sticky controls      E0/E3
txn -> first source capture -> scope/generation reuse -> revoke         E0/E1
SSR -> server-only memo -> missing path fatal -> dispose                E0/E1
sub -> initial read -> provisional -> attach -> mandatory sample       E0/E2/E3
    -> failure rollback / callback failure cleanup / warm retain      E0/E3
emit -> callback quarantine / dirty latch / ordered rounds            E0/E3
     -> partial-round bound / terminal error / later retry             E0/E3
hub -> depth-first independent tree / active ancestor / all-fire       E0/E3
release/dispose -> revoke -> all cleanups -> idle/terminal              E0/E3
React -> SSR/hydrate/rebind/StrictMode/abandon/inspect parity            E4
pack -> core-only reachability / React 18+19 / declarations / sizes     E4
```

All external paths are currently missing production coverage. E0 establishes
symbolic traces before implementation; later drivers replay the same protocol.
No snapshot value is included in inspection output. Error-path tests assert
exact identities, cleanup counts, publication absence, and final idle state.

### Work counters and performance gates

Freeze: `liveSamples`, `serverSamples`, `transactionCaptures`, `selectorEvaluations`,
`externalClosureVisits`, `lifecycleEdgeVisits`, `projectionPublications`,
`adapterSubscriptions`, `adapterCleanups`, `dirtyRounds`, `dirtySamples`,
`notificationSnapshots`, `subscriberCalls`, `thenableContainments`,
`deliveryEntries`, `deliveryLimitHits`, `nonConvergenceTerminations`.
Model traversal may be brute-force; algorithmic production counters must reflect
actual work, never oracle implementation overhead. Zero external work is required
for external-free paths. Preserve raw Bun/Node controlled measurements and
investigate repeatable regressions above 10%. Do not update size budgets to hide
growth. Hydration live-publication counters must remain zero.

React prior art confirms immutable stable snapshots and a separate server getter:
[React useSyncExternalStore reference](https://react.dev/reference/react/useSyncExternalStore).
This supports the adapter seam; repository contracts remain semantic authority.

## Historical implementation slices and landing topology

| Slice | Proposed branch | Base | Completion gate |
| --- | --- | --- | --- |
| E0 | current `implement-external-atom` | exact fetched main | independent model/protocol, transitions, adversarial/random traces |
| E1 | `feat/external-atom-pull` | E0 tip | unexported pull, capture, hydration, family internals |
| E2 | `feat/external-atom-lifecycle` | E1 tip | sparse retain plane, provisional ownership |
| E3 | `feat/external-atom-settlement` | E2 tip | attach/drain/cleanup, quarantine, finite bounds |
| E3.5 | `feat/external-atom-isolation` | E3 tip | occurrence ledger, notification contracts, optional runtime extraction |
| E4 | `feat/external-atom-public` | E3.5 tip | approved contracts, root API, React/packed/GC/perf/docs/changeset |

The rows above are implementation slices, not separate landing PRs. The final
landing topology is exactly two PRs: `implement-external-atom` → `main`, followed
by `feat/external-atom-public` → the corrected model branch (retarget to `main`
after the model lands). E1–E4, including the E3.5 repair/extraction slice, stay
together in the implementation PR. No PR is opened, pushed, or merged by this lane.
Sequential implementation ownership of the StoreTree kernel. Independent agents
review contracts and recovery/test evidence only; they do not edit the kernel.

The checklist reflects completed implementation work; runtime tasks belong to the
second PR. The repair certification and its disclosed baseline exceptions are
recorded below.

- [x] T1: implement independent external model and replayable trace protocol.
- [x] T2: implement pull/capture/hydration using existing host seams.
- [x] T3: implement sparse lifecycle and provisional registration.
- [x] T4: implement outer settlement ledger and bounded delivery.
- [x] T5: apply approved public decisions and certify all package/React gates.

## NOT in scope

Writable/global state, loaders/caches/SWR, async cleanup, timers/microtask queues,
second evaluators, collection expansion, browser package migration, version and
changelog edits, merges, and process-global registries are excluded by the brief.
The representative browser-adapter prompt follows core certification separately.

## E0 checkpoint evidence

Changes are limited to this design memo and `packages/valdres/test/v1-model`:
the new external protocol, independent model, regression/differential tests,
test-only barrel exports, and README. There is no production constructor or
export, contract-manifest edit, changeset, version bump, or PR.

- Model typecheck and all 90 model tests pass (50 external cases); 11,198
  assertions, including 32 seeds × 100 direct-source differential operations.
- The targeted v1 core run passes 617 tests / 364,444 assertions across 40 files.
  It includes model, evaluator, committed StoreTree, public candidate, inspection,
  and collection performance suites. No timeout or test was weakened.
- Post-change `check:contracts-v1` passes 56 tests / 441 assertions and both
  packages pass `typecheck:v1-beta`.
- A bundled model-only portability campaign performs 20,000 commands and
  produces exactly 10,000 callbacks and identical work counters on Bun 1.4.0
  and Node 24.21.0. Three process samples: Bun 32.55 / 38.32 / 38.87 ms;
  Node 49.59 / 38.96 / 41.15 ms. These are oracle portability measurements,
  **not** certification of runtime hot paths or the 10% regression gate.
- Clean-main baseline passes `check:contracts-v1`, `typecheck:v1-beta`,
  `test:v1-beta:packed`, and `check:package`. `test:v1-beta` fails its isolated
  tournament inventory after existing Git-history subprocess timeouts;
  `verify` exits 2 because local Node 24.21.0 differs from CI 24.16.
  Exact logs and command results are retained under
  `.context/external-atom/baseline/`. Baseline was captured before model edits.
- Public/package size delta is zero by construction: only docs and test modules
  changed. No new runtime packed artifact is claimed for E0.

Independent review counterexamples became regressions: lost dormant control
faults, unrelated external sampling, stale cached dynamic branches, stale dynamic
attachment catch-up, transaction comparator baseline, retained control
propagation, premature cleanup during delivery, reversed rollback error order,
swallowed nested-tree failures, and partial-round intermediate notifications.

Remaining: E1–E4, production differential drivers, runtime ownership/capability
matrix, weak routing/GC, React, and controlled runtime/packed certification.
The next proposed branch is `feat/external-atom-pull`, based on this E0 commit.
Gate 0 items 1–5 and the public family widening remain unapproved; all contract
evidence statuses remain unchanged.

## E1 internal checkpoint

Branch: `feat/external-atom-pull`, restacked on the repaired E0 tip `b91b03ed` (original model `ee32f87a`). The constructor is
an internal helper only; root exports, public contract evidence, family admission,
versions, changelogs, and changesets remain unchanged.

The internal vertical slice adds definition identity/validation and callback
quarantine, one weak projection map per StoreTree, sparse dormant closure refresh,
transaction-root capture, and isolated server sampling. `ScratchSourceKind.ext`
is now `collection`; the distinct `external` lane uses definition capabilities.
The existing adapter `assertStore` now checks liveness, including cached React
third-getter calls. The existing evaluator and propagation queue remain the only
evaluation/settlement machinery.

Files and ownership:

- `external-atom.ts` owns the unexported constructor, source callback guards,
  synchronous sample normalization, and provisional named errors.
- `external-projection.ts` owns the optional plane created privately by one host.
  It holds weak projections/routes and an operation-local sample/fault memo.
  `external-types.ts` contains its internal bindings; the domain's optional
  capability never stores projections or an enumerable host registry.
- `runtime-domain.ts` adds the weak definition registry and explicit callback
  activities. `types.ts` adds the internal readonly State arm.
- `scope-node.ts` carries immutable closure markers and updates their ancestors
  iteratively even for equal-valued topology changes.
- `committed-store-tree.ts` routes pull work into the existing queue, completes
  earlier publications after a later pull failure, and preserves failure order.
- `tree-transaction.ts` owns captures across all scopes/generations;
  `scratch-selector-host.ts` owns disposable dynamic server paths.
- `external-pull.test.ts` and `external-observations.test.ts` cover the new slice.

Focused evidence: 34 tests / 3,452 assertions, including 3,200 model/runtime
dynamic observations, a 16,000-selector equal-topology chain, partial-publication
failure completion, source ownership/quarantine, transaction capture/error retry,
and server isolation/path/thenable behavior. Both packages and the committed-tree
test project typecheck. Contract checks pass. A failed dynamic selector is retried
once per later pull, never twice while completing the same partial publication.
The broader targeted run passed 649 tests with one existing five-second
declaration-test timeout; that exact declaration suite
passed alone (3 tests, 28 assertions). No timeout was weakened.

The first paired timing harness shared one polymorphic call site between two
unrelated runtime copies. Reversing warmup order reversed its apparent Atom-read
regression. Those numbers are **invalid for the performance gate**, and remain
in `.context/external-atom` to document the rejected measurement. Corrected
independent loop functions retain alternating timed pairs. Latest Bun candidate/
baseline median ratios: Atom read 0.996, Selector read 1.083, write+notify 1.035,
subscribe 0.888, transaction 1.010. Node ratios were 1.029 / 0.984 / 1.027 /
0.993 / 1.028 before removal of a duplicate queue-status lookup. Each lane has
nine paired samples after warmup; read lanes perform two million operations.
These are E1 microbenchmarks, not final feature certification. Raw programs,
outputs, and the exact detached base are preserved for reproduction.

Package certification is still red. Moving external-only code out of eager core
reduced the ordinary adapter fixture's measured gzip growth from 11.78% to 7.47%
at that checkpoint; it still exceeds the immutable ordinary budget. No budget
was increased. `test:v1-beta:packed` stops at the old certified build digest before
consumer tests; it is not a passing packed run. Final exact-tarball sizes,
reachability, provenance, and reviewed feature-cost policy remain E4 gates.
Lifecycle/retained reads, provisional admission, attachment, drain bounds,
cleanup, final error metadata, and public family widening remain later slices.

## E2 internal checkpoint

Branch `feat/external-atom-lifecycle`, based on E1 `8fed5dbb`. The optional
host-owned plane now keeps separate weak scope/state retain records. Root
ownership belongs to each subscribed target; incoming lifecycle edges count
shared branches, whose dependencies are traversed only on 0/1 transitions.
Selector publications reconcile replacement branches before old releases.
Immediate-parent reconciliation handles unchanged external markers, and existing
subscriptions are discovered lazily when a first external definition appears.
Scope disposal releases saved retained edges. Zero-count records are removed.
Registrations now distinguish provisional, active, rolled-back, and removed
eligibility. Adapter callbacks remain unwired in this slice, so logical retention
does not yet suppress dormant polling.

Evidence: 43 focused tests / 3,484 assertions; broader committed-tree/model
selection 404 tests / 203,185 assertions; committed-tree test TypeScript project
passes. Nine lifecycle fixtures cover diamonds, registration multiplicity,
cross-scope aggregation, equal topology, late external definitions, child/root
disposal, failed admission, zero external-free traversal, and a warmed 16,000-edge
closure. Independent recovery review confirmed the ownership design and supplied
the late-definition and unchanged-parent-marker counterexamples.

E3 must still exercise provisional eligibility under real startup failures and
notifications, attach/detach, deferred cleanup, operation drain, and finite bounds.
E1 package certification and Gate 0 public approval remain open.

## E3 internal checkpoint

Branch `feat/external-atom-settlement`, based on E2 `dbf312e7`. The same
host-owned optional plane now owns generation tickets, ordered dirty projections,
deferred lifecycle acquisition/release, and an outer operation phase/failure
ledger. No second evaluator or commit pipeline was added. Source outcomes enter
the existing propagation queue together. Attachment catch-up clears per-wave
settlement status before propagating through the full DAG, while preserving one
final notification snapshot. First admission is provisional through the complete
outer drain; failed admission releases its otherwise unreachable registration.

The source generation is revoked before cleanup. Its old invalidator retains
only a cleared ticket. Last releases run after the full frozen callback snapshot
and before dirty drain. Round/sample exhaustion installs recoverable error
outcomes without detaching; cross-tree delivery limits leave the unentered target
retry-required. A later invalidation retries it. Retained error outcomes do not
poll. Failed dynamic attachment retains the existing subscriber and retries its
unattached branch only on a later admitted operation. Capability/owner preflight
runs before such frame admission. Pure immutable definition construction retains
its existing allowance; invalidators reject in initializers, selectors,
comparators, transactions, and source callbacks except the exact new startup
ticket. Top-level reads unwrap the final installed target after drain.

Selector records also carry an immutable dormant-closure marker. Attachment and
detach update that metadata through weak reverse routes, so cached selectors
whose sources are already active take constant work even when the selector itself
has no subscription. This is metadata propagation, not another evaluation path.

Files added in this slice: `external-settlement-contract.test.ts`,
`external-settlement-model.test.ts`, `external-drain.test.ts`, and
`external-retention.test.ts`. Kernel changes remain confined to the existing host,
scope records, and the three internal external modules. Root exports and public
catalog evidence remain unchanged. The two E1 pull cases that intentionally used
subscriptions without attachment now assert retained-source isolation instead;
the independent E0 protocol preserves its earlier partial-publication fixtures.

Behavioral evidence:

- Independent attach fixtures: 26 tests / 174 assertions.
- Independent production/model driver: 27 tests / 29,799 assertions, 7,437
  compared commands, including 24 seeds × 240 randomized steps. Exact read
  outcomes, per-target callback order, samples, attachments, and cleanup counts
  agree across roots, descendants, independent trees, errors, disposal, and stale
  generations. The model is unchanged.
- Drain/operation regressions: 15 tests / 84 assertions, including multi-level dynamic catch-up, invalid
  command admission, final post-drain reads, constant-work active closures,
  combined source publication, all-run cleanup, committed mismatch outcomes,
  partial-round exhaustion, and later cross-tree retry.
- GC found and fixed a real closure capture: the domain's factory shared its
  activation with the first definition. A separate factory scope now permits the
  dormant source/definition to collect. All three GC fixtures pass, including
  stale invalidators/unsubscribe handles and deterministic disposal.
- A first controlled subscription-churn measurement showed 1.525× Bun and 1.545×
  Node cost. Feature expansion paused. Restricting provisional fields, property
  deletion, and admission handling to the external plane restored the ordinary
  registration shape. Corrected Bun median ratios (Atom read / Selector read /
  write+notify / subscribe / transaction): 1.015 / 1.009 / 0.984 / 0.934 / 0.953.
  Node: 0.974 / 1.006 / 1.003 / 1.043 / 1.018. Raw paired samples and executable
  reproduction remain in `.context/external-atom/e3-performance-*`.

Final command results (raw logs use the `e3-` prefix in that same directory):

- `typecheck:v1-beta` and the committed-tree test TypeScript project pass.
- `check:contracts-v1` passes (56 tests / 441 assertions). The first concurrent
  attempt timed out in two unchanged frozen legacy inventory tests; an isolated
  retry passed without altering the inventory, tests, or deadlines.
- `test:v1-beta`: 728 pass / one isolated tournament-wrapper failure, 398,003
  assertions. Its child failures are the same 5-second historical-byte and
  30-second predecessor-lineage timeouts recorded on clean main. No timeout or
  test was weakened. The three final cleanup-thenable cases pass separately.
- React was skipped by that command's shell short circuit, so
  `bun --filter 'valdres-react' test` ran separately: 41 tests / 1,817 assertions,
  all passing. These are existing React tests, not ExternalAtom React certification.
- `check:package`: all manifest, publint, attw, declaration-consumer, Node/Bun,
  esbuild, Vite, and webpack checks pass; size fails. Ordinary adapter fixture:
  72,720 raw / 19,097 gzip, versus immutable 64,767 / 16,835 (+12.28% / +13.44%).
  Atom fixture: 72,749 / 19,128; selector fixture: 72,936 / 19,192.
  Packed package: 448,954 raw / 118,835 gzip, versus 421,964 / 112,570.
  Dist total: 318,350 / 93,086 versus 303,486 / 89,050. No ceiling or baseline
  changed. This requires further extraction or an explicit reviewed feature-cost
  policy in E4; it is not green certification.
- `test:v1-beta:packed`: three builds agree on
  `5595a4e2d176a21b6ecde1ffad7c2af74ea6349a0abf455c54a14d4d0107227a`,
  but the reviewed digest remains
  `dbb67fa96cc1d7667fb2903d24ae4ad12957e47f39df2a01e0deed20934ab509`.
  The command stops before packed consumer tests. Its workspace remains at
  `/var/folders/gp/mmw2g_j11fz61c5jmvzfgj9m0000gn/T/valdres-v1-beta-packed-XFbDie`.
- `verify` exits 2 before checks: local Node 24.21.0 differs from pinned 24.16,
  exactly as on clean main. No toolchain-drift override was used.

Public error classes/metadata remain provisional: internal mixed failures use
the proposed operation wrapper, and E4 must apply the approved lone-notification
and named lifecycle metadata to the exported contracts together. Package budgets,
packed provenance, public family admission, React external consumers, generated
API evidence, docs, and the single changeset remain E4 work. No PR is authorized
until Gate 0 approval and the relevant slice's certification are both complete.

## E3.5 repair and extraction (approved execution order)

Branch `feat/external-atom-isolation`, based on E3 `066b439c`. The owner explicitly
requires this repair commit to pass before starting public E4. The ordinary
adapter gzip ceiling remains 17,249 bytes; `coreRetainingGzipAllowance` stays 77.

Approved amendments:

- Root type exports are exactly `ExternalSource<T>`, `ExternalAtom<T>`, and
  `ExternalAtomOptions`, with explicit catalog entries and no internal lifecycle
  type exports. Live/server thenables share the approved named synchronous error.
- Pure notification failures retain `SubscriberNotificationError` with their
  external source; only mixed-phase and setup/cleanup aggregation use
  `ExternalSourceOperationError`. Every failure occurrence is preserved, including
  two callbacks throwing the same object. All public metadata is frozen and
  catalogued, including directly thrown lifecycle and bound errors.
- Missing server paths contain exact State handles, requested target through
  missing ExternalAtom inclusive, in a frozen array.
- Each constructor call creates a fresh definition. Structural non-null,
  non-array sources keep inherited method receivers; methods are captured once
  in deterministic order. Unknown option keys reject.
- Family admits same-domain ExternalAtoms created in the active factory frame
  or already published as family members. Arbitrary pre-existing States and
  collection States remain rejected. Reacquisition remains Atom-only.

Extraction uses the existing optional `externalRuntime` capability and existing
StoreTree propagation queue. Construction/runtime installation, admission policy,
closure-marker traversal, external sampling, and failure bookkeeping belong to
that optional implementation. The core retains narrow dispatch hooks and its
existing graph/queue ownership. Independent size attribution established that
Bun already dropped the projection implementation at E3: host additions cost
most of the 1,848-byte gzip overage. Removing the static import alone is insufficient.

The repeated-cause regression reproduces two setup failures, two cleanup failures,
and setup plus rollback cleanup using the same application error. A propagated
control outcome carries an internal occurrence token. The operation ledger tracks
that token, so observing one occurrence through multiple selector ancestors adds
no duplicate; a later operation still reports the stored control error. Distinct
callbacks always retain distinct occurrences even when they throw the same
application object. Application errors are never identity-deduped. Pure owned
mutation mismatch-plus-notification delivery retains its existing subscriber
wrapper even when an unrelated ExternalAtom has installed the optional plane.

Public PR topology is now E0 model, then one implementation PR containing E1–E4,
including the required E3.5 repair commit. The individual local slice commits stay
reviewable, but no intermediate PR exposes ExternalAtom through public State
without the approved factory and catalog entries. No PR is opened while its
relevant certification is red.

The extraction also removes an older capability coupling: the public domain now
contains only shared runtime records. Separate internal functions construct
Atoms, Selectors, Stores, and adapters from those exact records. The complete
internal domain factory still composes them for model/architecture fixtures.
Collection presence and inspectable Stores use the same identity. Hydration
orchestration lives in the adapter capability, with narrow draft/scratch/fallback
bridges to the existing host. No second Store implementation or evaluator exists.
Transaction capture policy lives in `externalRuntime`; its memo remains owned and
cleared by the root TreeDraft, independently of scope scratch generations.

E3.5 measured ordinary fixtures (immutable baselines and allowance unchanged):

| Fixture | Raw bytes | Raw ceiling | Gzip bytes | Gzip ceiling |
| --- | ---: | ---: | ---: | ---: |
| Atom | 14,710 | 66,093 | 4,610 | 17,276 |
| Atom / Selector / Store | 65,754 | 66,284 | 17,341 | 17,346 |
| Family | 20,840 | 71,482 | 6,388 | 18,990 |
| Adapter | 15,774 | 66,063 | 4,757 | 17,249 |

The four fixtures exclude projection/construction sentinels. Atom, family, and
adapter additionally exclude Store construction. Adapter gzip fell from E3's
19,097 to 4,757; the shared runtime records remain compatible across imports.
The combined fixture has only five gzip bytes of remaining headroom, so E4 must
recheck all ordinary gates after its final module graph is built.

Validation on this extraction: 731 functional tests / 345,638 assertions across
model, evaluator, committed tree (including external and GC), public candidate,
and inspect; 56 contract tests / 441 assertions; 41 React tests / 1,817 assertions;
both package typechecks pass. Package manifest, publint, declaration consumers,
Node/Bun smokes, esbuild, Vite, and webpack pass. Controlled final Bun 1.4 / Node 24.16 median ratios against the exact original
base are, respectively: Atom reads 0.976 / 0.992; Selector reads 1.025 / 1.026;
write/notify 1.008 / 1.005; subscriptions 1.035 / 1.050; transactions 1.014 / 1.017.
The longer 400,000-operation subscription fixture reports 1.000 / 1.027. Every
final lane is below the 10% regression threshold. Raw paired samples and harnesses
are preserved under `.context/external-atom/` (`*certified.jsonl`).

The full package command still reports 12 pre-E4 feature/artifact budget failures
(dist/packed and collection/query/all-exports/inspect), but no ordinary fixture
failure. Those measured feature budgets and the three-build digest belong to
E4's explicit packed certification; no baseline, allowance, or digest has been
changed in E3.5. The packed command reproduces three identical builds then stops
at the existing certified digest. `verify` initially stopped at installed Node
24.21 versus CI's 24.16; Node 24.16.0 is now available through an isolated npm
exec cache for final certification. The earlier broad runtime command reproduced
clean-main historical tournament timeouts without changing their limits.

Commit this certified E3.5 repair, then create `feat/external-atom-public`
from the repair commit and finish root/family, React, declarations, packed
consumers, docs, and one changeset. No partial public implementation PR is opened.

## E4 public certification

E4 is based on E3.5 commit `164abf00`
on `feat/external-atom-public`. The public surface now includes the approved
factory, exactly three named ExternalAtom types, and seven named error classes.
Family admission accepts same-domain definitions constructed in the active
factory frame or an already-published member; collection rejection and
Atom-only reacquisition are unchanged. An entry-owned factory interface makes
emitted user declarations refer to the root ExternalAtom type.

The contract catalogs contain 151 API entries, 20 callback entries, and 82
contract IDs. Twelve ExternalAtom-specific migration rows are marked complete
only after runtime, declarations, React, packed, isolation, and contract evidence.
The broader catalog and independent family ShiftX handoff remain partial.
Public error metadata and exact-handle server dependency paths are frozen.

Inspection adds external references, flat work counters, and structural action
rows without retaining application values, source objects, callbacks, errors,
or State handles. Isolated transaction/server observations record counters only.
React required no production change: ordinary and inspect bindings already use
the corrected core adapter seam. New source and packed fixtures certify actual
SSR/hydration, third-getter caching, server/live divergence, missing dynamic
paths, thrown/returned thenables, StrictMode, abandoned renders, disposal, and
Store/State rebinds under React 18 and 19.

Final review found two additional failure-boundary defects and fixed both:
application-thrown public wrappers were unpacked by class identity, and publish
instrumentation ran before the epoch update. Only the core's completed
notification boundary now forwards its own wrapper through the optional plane;
raw setup, cleanup, updater, transaction, snapshot, subscriber, and instrumentation
errors preserve exact identity and occurrence counts. Publish diagnostics run
after the epoch changes. Cleanup-triggered attachment retries attribute pure
notification errors to `external-startup`. Regression fixtures cover empty
wrappers, repeated identical wrappers, all-run delivery/cleanup, pre/post-publish
metadata, bounded delivery plus instrumentation failure, and recovery.

### Final measured artifacts

Three byte-identical Bun 1.4 runtime builds produced digest
`de184fca5c0eb9bc52fc3e924a586b0dc9c1ce246627f7007f64de8f8b6838e2`.
The packed core/React matrix passes Node 24.16 and Bun, TypeScript declaration
emit, esbuild browser execution, React 18.3.1/19.1.1 ordinary and inspect probes,
and a standalone core-only consumer with no React dependency. Source package
manifests remain byte-for-byte unchanged by packing.

| Fixture/artifact | Raw bytes | Gzip bytes | Ordinary gzip ceiling |
| --- | ---: | ---: | ---: |
| Atom | 14,710 | 4,607 | 17,276 |
| Atom + selector + Store | 65,777 | 17,346 | 17,346 |
| family | 20,868 | 6,389 | 18,990 |
| adapter-internals | 15,774 | 4,757 | 17,249 |
| ExternalAtom + Store | 86,234 | 22,888 | dedicated feature budget |
| collection | 99,701 | 27,727 | feature budget |
| query (both conditions) | 105,462 | 29,560 | feature budget |
| all exports | 124,076 | 34,679 | feature budget |
| inspect | 102,745 | 27,344 | feature budget |
| distribution total | 358,936 | 105,106 | artifact budget |
| packed package | 505,848 | 133,310 | artifact budget |

Ordinary baseline values, tolerance, and the 77-byte allowance are unchanged.
The combined ordinary fixture has no remaining gzip headroom. Guards assert
that all four ordinary fixtures exclude the external projection plane; Atom,
family, and adapter fixtures also exclude Store construction. The dedicated
ExternalAtom consumer excludes React and unrelated family/hydration modules.
E4's approved feature/artifact budgets were set from these measured artifacts;
they do not redefine ordinary consumer budgets. Distribution growth includes
production/development external capability code; packed growth also includes
approved declarations and README documentation.

### Performance evidence

Final paired original-base measurements use separate monomorphic callers,
alternating baseline/candidate order, and preserve every sample in
`.context/external-atom/e4-*.jsonl`. Node 24.16 ratios: Atom 1.001, Selector 0.943,
write/notify 1.033, subscriptions 1.059, transactions 1.011; the longer 400,000
subscription lane is 1.061. Bun read/write lanes remain below the 10% gate.
Short Bun allocation-heavy lanes were noisy (subscription 1.111/1.203 and
transaction 1.140/1.083); these samples are retained, not averaged away. The
400,000 subscription lane is 1.017. Investigation of transaction heap carryover
used 100,000 operations with collection before each timed run: two independent
ratios are 0.968 and 1.060. A direct E4/E3.5 comparison is 0.919. The apparent
regression did not reproduce under controlled heap conditions; no production
change was made to chase those timings. Work-counter tests continue to prove
zero external work on ordinary paths, constant-time retained reads, one adapter
attachment per tree/definition, and one transaction capture per identity.

### Documentation and follow-up

`docs/external-atom.md` documents the approved API, lifetimes, immutable errors,
transactions, family, SSR, and inspection. `docs/howto-external-atom.md` includes
executed and typechecked core and SSR examples. Root and generated core READMEs
link these documents. One core/React changeset records the feature; no package
version, changelog, lockfile, or release VERSION changed. The bounded synthetic
hub follow-up is in `docs/designs/external-atom-adapter-follow-up.md`.

### Final local CI checkpoint and stack handoff

The final source passes the dedicated model, evaluator, committed StoreTree,
public declaration, contract/ledger, and typecheck gates. `verify` used CI-pinned
Bun 1.4.0 and Node 24.16.0. Its initial release-infrastructure failure identified
an outdated expected feature-fixture list; adding the approved `external-atom`
fixture to that assertion fixes it. The built-root export assertion likewise
now enumerates the approved factory and seven errors. These are contract
snapshot updates, not weakened checks.

- Broad core runtime: **782 pass, 1 known baseline failure, 398,618 assertions**.
  The failure is the isolated tournament wrapper after its historical-bytes
  subprocess exceeds 5 seconds and predecessor-lineage subprocess exceeds
  30 seconds. Both reproduce in the preserved clean-main baseline. No timeout,
  inventory, or test was relaxed. The standalone focused run before the final
  publication-hook regression was 766/766; final committed-tree and broad-core
  runs also cover that added regression.
- Core build/package-export tests: **7 pass, 33 assertions**.
- Full React source/build suite: **74 pass, 2,154 assertions**, including 33
  ExternalAtom tests / 209 assertions, with strict test typechecking.
- Contracts and production-ledger guards: **62 pass, 527 assertions**.
- Release infrastructure: **311 pass** after the new feature fixture inventory
  entry. Generated README and unchecked-suppression gates pass.
- JUnit coverage, package red/green self-test, manifest, publint, ATTW, all
  declaration consumers, Node/Bun smokes, esbuild/Vite/webpack, size gates, and
  packed core/React consumer matrix pass. The final resume covers workflow
  steps 17–19. The overall workflow is reported with its baseline failure,
  not relabeled as an entirely green full run.

Exact commands/logs: `e4-verify-final.log` (steps 1–12),
`e4-verify-resume13.log` (steps 13–16 and baseline timeout),
`e4-core-build-certified.log`, `e4-react-final.log`,
`e4-verify-resume17.log` (steps 17–19), and `e4-packed-certified.log`, all under
`.context/external-atom/`. The clean-main comparison is
`.context/external-atom/baseline/test-v1-beta.log`. Invoke commands through
`npm exec --yes --package=node@24.16.0 -- bun run ...` to use CI's Node pin.

The local stack preserves E0 `ee32f87a` plus model repair `b91b03ed`, E1 `8fed5dbb`, E2 `dbf312e7`,
E3 `066b439c`, E3.5 `164abf00`, then E4 `35630596` containing this checkpoint.
Prepare exactly two PRs: model branch `implement-external-atom` → `main`, then
`feat/external-atom-public` → `implement-external-atom`. Merge the model first
and retarget the implementation to main. E1–E4 are reviewable commits inside the
single implementation PR. Prepared titles/bodies are in
`.context/external-atom/pr-model.md` and `pr-implementation.md`. No branch was
renamed, PR opened, commit pushed, or merge performed in this feature task.

## GSTACK REVIEW REPORT

| Review | Trigger | Status | Findings |
| --- | --- | --- | --- |
| Engineering | `/plan-eng-review`, approved owner amendments | Architecture implemented | Existing evaluator/queue; optional capability seam |
| Independent public and React fixtures | E4 contract certification | Pass | Runtime/declaration and React boundaries covered |
| Structural implementation review | `/review` checklist, native bounded review | No remaining actionable finding | Raw-wrapper provenance and publication metadata fixed |
| Documentation review | `/document-generate` plus independent factual check | Corrected and examples verified | Definition capabilities and streaming ordinary-state conditions clarified |

External-provider review was not run; the native structural review is not
represented as cross-provider coverage. Final local CI results and the reproduced clean-main exception are recorded in
the certification checkpoint above.

NO UNRESOLVED DECISIONS


## Pre-PR review repairs (2026-09-17)

This checkpoint supersedes the historical E4 certification above. The final
landing topology remains exactly two PRs; no PR is opened or pushed in this
repair lane. Historical E0–E4 commits remain reviewable slices inside that stack.

The model branch now includes `b91b03ed`, which separates source identities from
invalid-snapshot, non-convergence, control, and model-error identities. All tags
are deterministic JSON values. Three collision regressions failed on the old
model; the repaired independent model passes 88 tests / 11,168 assertions.

The host now carries a primitive operation cursor and starting epoch before
optional capabilities exist. A plane created inside a family/selector adopts
that exact context, all prior control occurrences, and one read memo. It finishes
at the original operation boundary. Cached ordinary reads/subscriptions bypass
that cursor; successful ordinary operations allocate no external records.
Control outcomes carry their evaluator origin before any plane is installed.
Thirteen fresh-domain scenarios cover admission, catch-up, propagation, equal
values with changed dependencies, rollback, stale invalidators, transactions,
read memoization, phase reset, and one/multiple prior control failures.

Lifecycle passthrough now uses a private callback-extent occurrence map and
ledger classifications. Nested source accessors, factories, and encoders forward
real guards; a public constructor or replaying an old guard cannot acquire this
provenance. Nonsticky guards remain catchable. The constructor accepts a readonly
nonempty failure tuple and deliberately rejects an empty JavaScript list with
the catalogued TypeError. Thirty-five new provenance/constructor tests and a
packed declaration probe certify this boundary.

The ExternalAtom GC helper uses actual timer tasks between collections, and each
of its three unchanged scenarios now runs in a bounded child process. The parent
requires successful exit and a sentinel emitted after every assertion completes.
An initial timer-only repair passed the mixed suite (321 / 44,465 assertions),
but the complete host suite exposed conservative engine roots. Heap snapshots
found no source/invalidator/provenance retaining path; scheduling, explicit local
release, JIT disabling, and snapshot experiments were not reliably sufficient.
Process isolation removes unrelated test allocations from this measurement.
All 20 attempts, live-ownership checks, and zero-survivor assertions remain; no
production workaround or snapshot hook is retained. The repair audit includes
the passing isolated suites and a deliberate retained-owner mutation that the
same assertions reject.

### Reviewed repair size decision

Ordinary baselines, their 2% tolerance, and `coreRetainingGzipAllowance: 77` stay
unchanged. The combined ordinary fixture is 17,345 gzip bytes against 17,346.
Ordinary Atom/family/adapter fixtures still exclude the projection plane.

The optional family registry now owns its existing Atom retention policy; scope
ownership and counters are unchanged. Its scope field is declared rather than
initialized on every scope, so definition-only consumers no longer retain that
class through a computed field initializer. Shared outcome comparison and guard
completion remove duplicated code, while host-only policy delegates through the
optional plane. Independent read-only review found no new public surface,
ordinary operation allocations, ownership edges, or counter changes.

Feature-only budgets are deliberately recertified for the repairs below, not
used to relax ordinary limits. The dedicated ExternalAtom fixture falls from
86,234 to 85,834 raw bytes and rises from 22,888 to 23,133 gzip bytes (+245, 1.07%).
The smaller raw program compresses differently after coherent host adoption and
occurrence provenance replace class-based classification and recursive wrappers.
The complete build/package totals additionally include the nonempty constructor
and optional internal seam declaration changes. These deltas received independent
architecture review; the review found no leaked projection dependency or second
kernel. The exact measured table and final certification follow below.

| Feature artifact | Previous raw / gzip | Repaired raw / gzip |
| --- | ---: | ---: |
| dist | 358,936 / 105,106 | 358,962 / 105,858 |
| packed | 505,848 / 133,310 | 506,987 / 134,233 |
| collection | 99,701 / 27,727 | 99,026 / 27,730 |
| all-exports | 124,076 / 34,679 | 124,042 / 35,010 |
| inspect | 102,745 / 27,344 | 102,070 / 27,317 |
| query | 105,462 / 29,560 | 104,787 / 29,548 |
| query-development | 105,462 / 29,560 | 104,787 / 29,548 |
| external-atom | 86,234 / 22,888 | 85,834 / 23,133 |

Final ordinary fixtures are Atom **6,357 / 2,302**, combined Atom/Selector/Store
**65,105 / 17,345**, family **13,539 / 4,448**, adapter **8,003 / 2,704**, and
equality **7,231 / 2,210** (raw / gzip). All isolation assertions pass.
The packed-consumer shadow tarball measures **498,503 / 130,228** because that
existing staging flow copies only dist and the manifest; the full package gate
also includes the unchanged 7,414-byte README and 1,070-byte license and verifies
the larger full-artifact budget shown above.

Changeset classification is core **minor**, React **patch**. No package version,
beta number, changelog, or release commit is introduced.

### Controlled performance after repair

The source was frozen before measurement. Separate baseline/candidate callers
compare exact main `270f00e46f26aee66a724fcf6d6fdda09ddcf133` with the repaired
runtime, using warmup and nine samples with alternating order. Raw samples are
retained under `.context/external-atom/repair/*-certified.jsonl`.

| Ordinary lane | Bun ratio | Node 24.16 ratio |
| --- | ---: | ---: |
| Atom read | 0.857 | 0.776 |
| Selector read | 0.876 | 0.645 |
| Write + notify | 0.825 controlled | 1.007 |
| Subscribe/unsubscribe, 400,000 operations | 1.010 | 1.033 |
| Transaction | 0.973 controlled | 1.095 |

The short Bun write lane measured 1.143, and the short Node subscription lane
measured 1.145. These results remain in the logs. Longer subscription runs and a
200,000-operation write lane with collection before each timed run did not
reproduce a material regression. The Bun transaction control uses 100,000
operations with the same collection discipline. No results were averaged away
and no production code was changed to chase these final timings.

Build the preserved `.context/external-atom/e1-performance-monomorphic.ts`,
`e35-subscribe-performance.ts`, `e4-transaction-gc-controlled.ts`, and
`repair-write-gc-controlled.ts` with `bun build --target=node --outfile=...`.
Run the resulting files with Bun and, for the ordinary/long-subscription lanes,
`npm exec --yes --package=node@24.16.0 -- node ...`. Work-counter and ownership
tests remain the algorithmic gate, alongside these timing comparisons.

### Previous repaired stack (superseded by the retry/provenance checkpoint below)

The model branch ends at `b91b03ed5d69f37518870a0720b013d4e00245e6` after E0
`ee32f87a2a5782e03688d2e9e6b446e8deb849f0`. The implementation retains restacked
E1 `8fed5dbbe0a993716c569a8a38f048a0a52d6408`,
E2 `dbf312e729449ea680e1e6647ad9a13d20266185`,
E3 `066b439cb672dd683bce2742701532d33054f386`,
E3.5 `164abf00c84a39410559be1d4ff921ba1eec1867`, and
E4 `35630596945e9d7c4d9eda9f59692ba0c1f717c7`.
Runtime/API repair `ee3283636abee5396b0db4f7aa580d5bd88fec24` follows E4; this
documentation/certification checkpoint follows as a separate commit. The model
remains independently landable and contains no production/package implementation.
The two PR heads and bases remain exactly as specified above.

### Final repair certification

- Independent model: **88 pass / 11,168 assertions**, with source-only typecheck
  and matching 20,000-command Bun/Node portability counters.
- Evaluator/oracle: **118 pass / 10,236 assertions**.
- Complete StoreTree package: **346 pass / 212,564 parent assertions**, twice,
  plus nine unchanged GC assertions inside bounded children. Typechecking passes.
- Final complete core runtime: **833 pass, 1 reproduced baseline failure,
  398,948 parent assertions**, plus the nine child GC assertions. Fresh-domain
  public admission and all randomized differential/retention cases pass.
  Declaration emission passes in 3,482.84ms; its earlier 5,052.56ms timeout under
  concurrent diagnostics is retained in the preceding run's log.
- Full React: **74 pass / 2,154 assertions**. Core build/export tests:
  **7 pass / 33 assertions**. Contract/ledger guards: **62 / 527**.
- Release infrastructure: **311 pass**. Build, declarations, public types,
  no-unused/suppression gates, generated READMEs, and core-load checks pass.
- Package self-tests, publint, ATTW, declaration consumers, Node/Bun runtime
  consumers, esbuild/Vite/webpack, and ordinary/feature size guards pass.
  Packed standalone ExternalAtom and React 18/19 hydration/StrictMode/rebind
  consumers pass. Three builds reproduce SHA256
  `1224bc17c996fa48782ce9fe09890b17a62c2fa90a417b8ca257c998893d3ae5`.

The broad workflow was invoked with
`npm exec --yes --package=node@24.16.0 -- bun run verify` and explicit resumptions
`--from=3`, `--from=4`, `--from=12`, `--from=16`, and `--from=17`. Logs are
`.context/external-atom/repair/verify-certified{,-retry,-resume4,-resume12,-resume17}.log`
and `verify-core-final.log`. The successful standalone contract gate is
`contracts-certified.log`; final package/packed evidence is `package-certified.log`
and `packed-certified-final.log`. Core build and React JUnit reports are freshly
generated after the runtime command's baseline failure short-circuits those
commands. No failed run is relabeled as a fully green workflow.

The final `--from=17` run passes steps 17–19 (JUnit coverage, package self-test,
and packed matrix). One intervening core-build attempt reports existing relative
modules as missing in Bun's resolver; the unchanged fresh-process retry passes
7/7, and both subsequent package builds pass. Its failed log is
`core-build-junit-final.log`; successful logs are `core-build-junit-retry.log`
and `react-junit-final.log`. No source or test change was made for that retry.

The exact current `origin/main` remains
`270f00e46f26aee66a724fcf6d6fdda09ddcf133` after a final fetch. In its clean
comparison worktree, `bun test --reporter=dots test/selector-kernel-tournament`
reproduces the historical-bytes 5-second timeout, predecessor 30-second timeout,
and parent 110-second timeout (`repair/main-tournament.log`). The repaired final
run has the same three timeout boundaries. No tournament code or limit changed.

The archived mutation-scan portion of the contract command also timed out in two
workflow attempts. The standalone repaired contract command passes. Running that
same command on clean current main reproduces the five-second timeout boundary
in the same archived suite, with different cases failing (bracket access/generic
receiver, while the candidate's destructured-receiver case passes there in
4,828.92ms). This is recorded precisely in `repair/main-contracts.log`; it is not
claimed to be identical failed fixture names. No frozen source, inventory, digest,
assertion, or timeout was relaxed.

The comprehensive local handoff, full commit hashes, regression inventory, raw
command results, and final cleanliness checks are in
`.context/external-atom/repair-handoff.md`. No branch was pushed, PR opened or
updated, merge performed, or package version changed by this repair.


## Retry and hostile-value repair checkpoint (2026-09-18)

The model repair is on `implement-external-atom` at
`f5b18c1caed79dc8691a84c46e0324af0d546e86`. The implementation branch was locally
restacked from model head `b91b03ed` onto this repaired head, preserving all seven
implementation commits. The two-PR landing order remains model → main, then
implementation → model; no PR or push is part of this repair.

### Invariants and error identity

Accepted invalidations now clear the retry marker before the active-operation
shortcut. Capability and terminal rejection preserve it, and a subsequent delivery
bound sets it again. The model resets the marker on attachment and revocation.
Production stores it on the generation ticket, so revocation and replacement cannot
carry it into another generation. A read-only method on the internal projection
class lets tests observe this invariant; no public Store, State, inspect, or root
export was added.

The recorded-failure transport is one module-private unique symbol. All three
sentinel sites use strict identity, including notification forwarding and read
settlement. Public setup and cleanup tests throw a Proxy whose `getPrototypeOf`
trap throws, and require the original Proxy as the exact operation-error cause
with zero trap calls.

Runtime mismatches receive private WeakSet membership only at the internal
creation site. Classification requires both membership and current occurrence
provenance. Public construction grants neither, and replaying a previously genuine
error in a later callback grants no occurrence provenance. The public regression
installs a throwing `RuntimeMismatchError[Symbol.hasInstance]`, verifies the exact
ordered mismatch/subscriber causes in `SubscriberNotificationError`, and restores
the original descriptor in `finally`.

To preserve the ordinary size cap, ownership validation uses native weak membership
for arbitrary inputs and native own-descriptor lookup for non-null inputs (primitive
boxing invokes no application callback). Sticky-fault precedence is expressed once
in `finally`. A mismatch's sticky session already conveys its occurrence, including
through nested guarded callbacks, so its duplicate callback-ledger registration is
removed. The existing spoofing, nested-callback, replay, and pre-install-fault suites
certify those paths. No ordinary budget or shared allowance changes.

### Regression evidence

- `review2/model-red.log`: both depth/work active-retry regressions fail on the old
  model, after the correct new value has already published. The repaired independent
  model passes **90 tests / 11,198 assertions**, including every identity test, and
  its source-only typecheck passes.
- `review2/retry-red.log`: both production tests fail at the stale private marker
  with the read-only probe installed. The repaired tests cover active retry,
  detach/reattach, later bound rejection, stale invalidators, and capability and
  terminal rejection.
- `review2/runtime-red.log`: the public setup and cleanup regressions expose the
  prototype trap, and the public mismatch regression exposes the `hasInstance`
  hook. The corresponding repaired public tests pass.
- `review2/provenance-sticky.log`: all **35 provenance tests**, **13 fresh-process
  late-install cases**, and **19 public ExternalAtom tests** pass. Final broad
  verification reruns them with the final ownership implementation.

### Restacked implementation commits

1. E1 `3f95d4e0ca2597c31bdb40dd507dc6f53818944d`.
2. E2 `b3935d05a99c1af9383d5d7cf6a8ba94016075b4`.
3. E3 `31ed57b903bfa06b8aa7ff6c4b5a00e2e7c4aea4`.
4. E3.5 `a484b9b550706c8186f786d63257a6bef007e3a2`.
5. E4 `94d37f9a4336123b352a14e9a8b8b2ba7eb91f4f`.
6. Previous runtime/provenance repair `6048823fc52e3a5b726b453250979c201d1b8a88`.
7. Previous certification `b2af25158dd115b1416544941f352979591281de`.
8. Retry and prototype-independent classification repair
   `e40d839dc8cfc8cbca4a3a4641ff9c6ca0db1ac4`.

The certification/documentation commit follows this list. Exact final heads and
complete command logs are recorded in `.context/external-atom/review2/handoff.md`.

### Measured artifact changes

Measurements are bytes, relative to supplied implementation head `2f2359e6`.
The ordinary 2% policy, immutable baselines, and **77-byte shared allowance** are
unchanged. Ordinary fixtures still exclude the projection implementation.

| Artifact | Raw | Raw delta | Gzip | Gzip delta |
| --- | ---: | ---: | ---: | ---: |
| Atom | 6,373 | +16 | 2,305 | +3 |
| Atom / selector / Store | 64,899 | -206 | 17,345 | 0 |
| family | 13,333 | -206 | 4,443 | -5 |
| adapter internals | 7,780 | -223 | 2,674 | -30 |
| equality | 7,231 | 0 | 2,210 | 0 |
| ExternalAtom | 85,734 | -100 | 23,148 | +15 |
| collection | 98,820 | -206 | 27,732 | +2 |
| query / development | 104,581 | -206 | 29,555 | +7 |
| all exports | 123,942 | -100 | 35,017 | +7 |
| inspect | 101,848 | -222 | 27,300 | -17 |
| core dist | 358,800 | -162 | 105,942 | +84 |
| full packed core | 507,033 | +46 | 134,386 | +153 |

The combined ordinary fixture remains **17,345 / 17,346 gzip bytes**; adapter
internals are **2,674 / 17,249**. Only affected feature budgets and the runtime
build digest are recertified. Changes come from private mismatch membership,
generation-owned retries, the internal invariant probe, symbol transport, and
ownership-guard simplification; declaration bytes account for packed growth even
though runtime raw bytes shrink.


### Final sequential certification

All commands use pinned Node 24.16.0 via
`npm exec --yes --package=node@24.16.0 -- ...` and Bun 1.4.0. No benchmark or
contract job was launched concurrently with the broad workflow.

| Gate | Result |
| --- | --- |
| Contracts and migration ledger | 62 pass / 527 assertions |
| Build, declarations, source/public typechecks | Pass |
| Independent model (including identity tests) | 90 pass / 11,198 assertions; separate model-worktree typecheck passes |
| Evaluator/oracle | 118 pass / 10,236 assertions |
| StoreTree, including external differential/provenance/GC suites | 348 pass / 212,614 parent assertions, plus nine GC assertions in bounded children |
| Full core runtime, including public and inspect | 840 pass / 399,051 parent assertions; one tournament timeout |
| Fresh-process late installation | All 13 pass inside the full core run |
| Build-output tests | 7 pass / 37 assertions, through both package and workspace commands |
| React, including SSR/hydration/rebind/StrictMode | 74 pass / 2,154 assertions |
| Release infrastructure | 311 pass / 1,239 assertions |
| Suppressions, generated READMEs, core-load, JUnit coverage | Pass |
| Package mutations/self-tests, publint, ATTW, declaration consumers, bundlers, size/tree-shaking | Pass |
| Packed Node/Bun, standalone ExternalAtom, React 18.3.1 and 19.1.1 consumers | Pass |
| Reproducible runtime build certificate | Three byte-identical builds |

The certified runtime SHA256 is
`84b5b39fbdf50bc6bac795f7a02e0ae485a26c7f4d17539e3de2bffb7f5c6fe7`.
The packed-consumer shadow artifact omits the README/license payload; it measures
498,549 raw / 130,384 gzip, versus the full artifact's 507,033 / 134,386 above.

Broad commands were `bun run verify`, `bun run verify --from=11`, and
`bun run verify --from=17`. The first run caught an extra argument in a new test
assertion; correcting that test allowed the complete StoreTree gate to pass.
Step 16 remains failed solely on the tournament subprocess, so the resumed
steps 17–19 are not represented as an uninterrupted green broad command.

The core failure short-circuits build-output and React execution. Those commands
were run explicitly with fresh JUnit reports before steps 17–19. Build-output
attempts intermittently reported existing relative modules as missing, through
both the workspace filter and direct package command. Moving the split-graph
compiler into a child made its three consumers pass and exposed the same failure
at the remaining in-process tarball build. Moving that compiler into a child too
makes both invocations pass **7 tests / 37 assertions**. The children import the
unchanged production build options and build each requested graph sequentially.
Every prior compiler/artifact assertion remains; four new assertions require
successful child exits and complete result arrays. No compiler timeout changes.

Passing logs are `build-output-isolated-all.log` and
`build-output-isolated-direct.log`; `build-output-isolated.log` records the
intermediate result (six pass, the remaining in-process compiler fails).
Earlier failed and passing attempts remain in `build-output*.log`. The isolated
harness has its own successful TypeScript check (`build-test-types.log`). Final
JUnit coverage is rechecked after both passing invocations (`junit-final.log`).
This test-only isolation changes no runtime artifact or certified digest.

Other logs under `.context/external-atom/review2/` are `verify.log`,
`verify-from11.log`, `react.log`, and `verify-from17.log`. The latter passes
JUnit coverage and every package/packed gate. No timeout, artifact assertion,
budget policy, version, or release metadata was weakened to obtain these results.

A fresh fetch confirms clean `origin/main` at
`270f00e46f26aee66a724fcf6d6fdda09ddcf133`. The isolated comparison worktree
reproduces the same historical-bytes 5-second child timeout, predecessor 30-second
child timeout, and 110-second parent timeout in `main-tournament.log`. A second
comparison with its root compiler dependency path linked also reproduces all three
boundaries (`main-tournament-ready.log`). Main build tests pass 7/7 directly and
through the workspace filter, with and without JUnit (`main-build-output-ready.log`,
`main-build-filtered.log`, `main-build-filtered-junit.log`). An initial optional main
build probe lacked its local compiler executable; that environment setup was
corrected before the final checks. No tournament source or timeout was changed.


## Generated error identity and lazy plane repair (2026-09-18)

This checkpoint supersedes the branch heads and certification tables above;
those sections retain the history of the earlier review passes. The landing
shape remains exactly two branches: `implement-external-atom` → `main`, then
`feat/external-atom-public` → the repaired model branch. Neither branch is pushed.

### Repair boundaries

The model previously compared every generated callback-capability fault by its
readable label. Two fresh runtime errors therefore appeared unchanged to the
oracle, suppressing both notifications. Generated outcomes and failure records
now carry a deterministic per-model allocation number, separate from their label
and identity space. Propagation, transaction captures, cached selector outcomes,
and the shared terminal outcome retain that allocation number. Reused source
symbols keep their original stable identity. The old regression gives zero
notifications; the corrected oracle and runtime both deliver two exact fresh
errors. Replay produces identical symbolic traces.

Domain installation previously disabled cached StoreTree paths and eagerly
created operation frames in every unrelated tree. Cached paths now consult the
tree's actual plane. Ordinary selector bookkeeping can observe an existing plane
but cannot create one. Only a committed reach of an ExternalAtom calls the
internal `reachExternal()` seam. That seam adopts the current operation cursor,
epoch, phase, and preceding control faults, including during propagation. Server
reads and transaction captures do not install the live plane. No public API or
runtime-domain registry is added.

`external-isolation.test.ts` counts allocations and operation starts through the
existing internal runtime factory. Cold and warm unrelated trees perform none;
a first committed external reach creates one shared plane. The 17 late-install
scenarios now run both with an absent runtime and with an unrelated source
already installed: 34 fresh processes. They cover dynamic dependency changes,
admission failure, startup catch-up, propagation, transaction-created sources,
control-fault transfer, and phase reset.

### Performance gate

`scripts/check-external-isolation.ts` is a required CI step and part of `verify`.
Run it with pinned Node using:

```sh
npm exec --yes --package=node@24.16.0 -- bun scripts/check-external-isolation.ts
```

Each of four workloads (cached selector reads, subscribe/unsubscribe, writes,
transactions) runs in fresh Bun and Node processes. Baseline and installed arms
load the same bundle; only the unused ExternalAtom definition differs. Nine
paired processes per arm alternate order, warm their JITs, and report individual
ratios. A one-sided 95% lower confidence bound above 1.10 fails the lane. Separate
workloads and engines are never averaged together. Structural zero-work tests
complement timing evidence on loaded machines.

Before repair, the gate failed for Bun reads/subscriptions and Node
reads/subscriptions/writes/transactions. Exact paired data are preserved in
`.context/external-atom/review3/performance-red.log`. Candidate measurements and
complete verification output are preserved in the same directory.

The final `verify` measurements were:

| Engine | Workload | Installed / baseline | Lower bound | Upper bound |
| --- | --- | ---: | ---: | ---: |
| bun | reads | 1.052× | 0.954× | 1.161× |
| bun | subscriptions | 1.016× | 0.939× | 1.098× |
| bun | writes | 1.035× | 0.969× | 1.106× |
| bun | transactions | 0.964× | 0.899× | 1.034× |
| node | reads | 1.077× | 0.998× | 1.162× |
| node | subscriptions | 0.976× | 0.929× | 1.026× |
| node | writes | 0.982× | 0.862× | 1.120× |
| node | transactions | 0.925× | 0.794× | 1.078× |

Bounds are separate one-sided 95% confidence bounds. No lane has a credible
regression above 10%; some upper bounds still exceed 1.10, so these measurements
do not establish a strict upper-bound guarantee. An initial noisy Node write
estimate of 1.114× did not repeat (0.982× in final `verify`). No performance threshold
or ordinary bundle allowance was relaxed.

### Independent review follow-up

Independent testing found that first reach *inside a subscriber callback* could
lose the second of two preceding control faults. The old eager plane retained
both; the first lazy implementation reduced the pending list before delivery.
The final host retains it until notification delivery completes, with an outer
`finally` clearing it on every exit. First reach adopts every occurrence exactly
once, and the host advances to the notifying phase independently of whether a
plane already exists. Core error assembly reads the remaining pending fault only
after all callbacks, avoiding duplicate forwarding after adoption.

Four fresh-process regressions cover zero, one, and two prior faults and a later
replay of the first error. They verify exact ordered causes, wrapper choice,
settling/notifying phases, owned-mutation/committed metadata, all-fire delivery,
zero source work during forbidden reads, and subsequent read/attach/release
recovery. The independent review's six probes match the preceding runtime exactly,
including the internal notifying phase and repeated error occurrences. Final
independent re-review reports no remaining actionable findings. Raw prior,
reproduced-failure, and repaired results are in `review3/independent-*.json`.

### Final artifact measurements

Ordinary combined Atom/selector/Store is **17,340 / 17,346 allowed gzip bytes**;
adapter is **2,674 / 17,249**. The ordinary baselines, 2% tolerance, and 77-byte
shared allowance are unchanged. Package-size checks reject optional projection
implementation in every ordinary fixture. Error assembly is centralized and
plane checks use the truthiness of the internal object-or-undefined slot.

| Artifact | Raw bytes | Gzip bytes | Gzip delta vs prior head |
| --- | ---: | ---: | ---: |
| Atom | 6,373 | 2,305 | +0 |
| Atom / selector / Store | 64,811 | 17,340 | -5 |
| family | 13,333 | 4,443 | +0 |
| adapter | 7,780 | 2,674 | +0 |
| equality | 7,231 | 2,210 | +0 |
| collection | 98,732 | 27,725 | -7 |
| all-exports | 123,840 | 34,999 | -18 |
| inspect | 101,760 | 27,291 | -9 |
| query | 104,493 | 29,558 | +3 |
| query-development | 104,493 | 29,558 | +3 |
| external-atom | 85,632 | 23,142 | -6 |
| dist | 358,596 | 105,898 | -44 |
| packed | 506,909 | 134,300 | -86 |

Only affected feature budgets and the runtime digest are recertified. Runtime
shrinks by 204 raw bytes; the internal coordinator declaration adds 80 bytes across
production/development trees, leaving the packed artifact 124 raw bytes smaller.
Public exports are unchanged. The certified runtime build digest is
`7102b3156af2d9d4528f72e4bf80783efce7768b94cce5bf21897ccd81778d1d`.

### Final verification and stack

The model branch ends at `bdcab35e6afd12ea87d50070bada6cc69fc81e41`.
The implementation is restacked on that exact head; the amendment after the first
restack only adds the model README explanation, and production source trees were
checked identical across that documentation-only restack.

Ordered implementation commits (after the model head):

1. `68e368d83c42c70c2be845e1f759eeca69f56d11` — WIP: implement internal external pull capture and hydration.
2. `cc9347648db3639f5bd8567284311bba6bca253a` — WIP: add sparse external lifecycle retention.
3. `0f4ef9afcda292ceda6129ce9b99078e280fb658` — WIP: implement bounded external attachment and settlement.
4. `7b4f716576181c9d37f90486be2b5601020971be` — Fix external failure occurrences and isolate optional runtime capabilities.
5. `3b3fd313ad404eb2595d15e4eca98f08151edf80` — Expose and certify read-only ExternalAtom public integration.
6. `1f1ffb1a6a41e7b1ea1d17310cb59346e355c829` — Adopt late external runtimes and preserve guard occurrence provenance.
7. `86a16660e10d875b996419c053bb37cc3aef4265` — Recertify ExternalAtom repairs and correct release classification.
8. `8a9038b1b7d77e6bd1c6ffabc3ded7ea25999dd4` — Repair external retry lifetime and classify failures without prototype hooks.
9. `17354b1652b6a5d095bdf57d7c5b7f782decdea4` — Isolate build-test compilation and recertify external repairs.
10. `30e432eb1b823691e660fe5d149fd2a69803e315` — Allocate external planes only when a StoreTree reaches external state.
11. `c119e9935b7055cce7f7a8fc279ecdef7eaf01aa` — Preserve pending control occurrences through first external reach in callbacks.

A final certification/documentation commit follows this list; the complete exact
heads and command logs are in `.context/external-atom/review3/handoff.md`.

Final `verify` used pinned Node 24.16.0 and Bun 1.4.0. No benchmark/contract jobs
were run concurrently. The final runtime passed:

| Gate | Result |
| --- | --- |
| Contracts/migration ledger | 62 pass / 527 assertions |
| Production build, declarations, source/public types | Pass |
| Packed core-load gate | 15 pass / 118 assertions |
| Installed-but-unrelated Bun/Node performance | All eight lanes pass |
| Independent model, including every identity test | 94 pass / 11,224 assertions |
| Evaluator/oracle | 118 pass / 10,236 assertions |
| StoreTree, including external/provenance/GC | 352 pass / 212,676 parent assertions |
| Focused model + external StoreTree/public/inspect | 337 pass / 45,740 parent assertions |
| Fresh-process public late installation | All 34 cases pass |
| Release infrastructure | 311 pass / 1,239 assertions |
| Full core runtime | 869 pass / 399,181 parent assertions; one tournament parent timeout |

StoreTree/core additionally execute nine assertions in bounded GC children;
fresh-process public fixtures execute Node assertions in their child processes.
Independent review additionally ran six focused probes against the prior and
repaired runtimes. The previous retry lifetime, hostile Proxy sentinel, and
public `Symbol.hasInstance` regressions remain passing.

The broad core failure short-circuited package build tests and React, so those
were run explicitly before resuming the remaining verification steps:

| Completion gate | Result |
| --- | --- |
| Core build-output tests | 7 pass / 37 assertions |
| React, SSR/hydration/rebind/StrictMode | 74 pass / 2,154 assertions |
| JUnit coverage | Pass |
| Package mutation/self-tests, publint, ATTW, declaration consumers, bundlers | Pass |
| Ordinary/feature size and projection exclusion | Pass |
| Packed Node/Bun, standalone ExternalAtom, React 18.3.1/19.1.1 | Pass |
| Runtime reproducibility | Three byte-identical builds matching the certified digest |

Exact commands (all at the workspace root unless specified):

```sh
npm exec --yes --package=node@24.16.0 -- bun run verify
npm exec --yes --package=node@24.16.0 -- bun --filter valdres test:build -- --reporter=junit --reporter-outfile=junit-build.xml
npm exec --yes --package=node@24.16.0 -- bun --filter valdres-react test -- --reporter=junit --reporter-outfile=junit.xml
npm exec --yes --package=node@24.16.0 -- bun run verify --from=18
```

`verify-final.log` records steps 1–17; the last three commands complete the
short-circuited build/React lanes and steps 18–20. This is not an unqualified green
`verify`: its one excluded tournament parent failure reproduces on clean
`origin/main` at `270f00e46f26aee66a724fcf6d6fdda09ddcf133`. From that clean
comparison worktree's `packages/valdres`, the command was
`npm exec --yes --package=node@24.16.0 -- bun test test/selector-kernel-tournament`.
Both candidate and clean main hit the historical-bytes 5-second child limit,
predecessor 30-second child limit, and 110-second parent limit. The full outputs
are `review3/verify-final.log` and `review3/main-tournament.log`; no timeout or
assertion was weakened.

The final packed-consumer shadow (without README/license payload) is 498,425 raw /
130,307 gzip bytes. Full-package figures above include that payload. Both package
and packed-consumer gates certify the same final runtime digest.

The historical E0 section's old 85/11,155 count is corrected to its 90/11,198
checkpoint; this pass's model count is 94/11,224. Implementation, model, and
comparison worktrees are clean at handoff. No push, PR creation/update, merge,
version bump, or new beta-labelled metadata is part of this repair.
