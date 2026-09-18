# ExternalAtom implementation contract and engineering review

Status: Gate 0 recommendations awaiting owner approval; E0 executable model checkpoint.
Review target: `.context/attachments/HYMHX1/external-atom-implementation-agent-prompt.md`.
Fetched base: `270f00e46f26aee66a724fcf6d6fdda09ddcf133` (`origin/main`, includes PR #397).
Initial branch: `implement-external-atom`; initial HEAD equals base. No branch rename.
No production/public export, version, changelog, or contract evidence change is authorized by this memo alone.

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

## Gate 0 recommendations

These are proposals, not approved public contracts. Items 1–5 require owner
confirmation before catalog changes or publication. Source citations are to the
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
   `"external-startup" | "external-invalidation" | "external-drain"`.
   Preserve mismatch-first ordering *within* a settlement. Across an outer
   operation, its first failure stays primary; append later failures in
   occurrence order after all delivery, cleanup, and drain work.

   For mixed-phase failures propose one additional immutable root class,
   `ExternalSourceOperationError / VALDRES_EXTERNAL_SOURCE_OPERATION`, with
   `cause`, frozen raw `causes`, and frozen `failures` records of
   `{ cause, committed, phase, source }`. Top-level `committed`, `phase`, and
   `source` mirror the primary record, not whether *anything* changed later.
   Phase domain: `"admitting" | "sampling" | "settling" | "notifying" |
   "cleanup" | "instrumenting"`. Source domain: `"owned-mutation" |
   "external-startup" | "external-invalidation" | "external-drain" |
   "external-cleanup"`. No named metadata type export is needed. Fixed message:
   `An external source operation failed`.

   A lone notification failure keeps its SubscriberNotificationError wrapper;
   a lone control fault remains exact. Named lifecycle/bound errors remain
   directly thrown when they are the sole failure, with immutable phase/source/
   committed metadata; when additional failures occur, the operation wrapper
   retains the exact original errors as causes. A lone arbitrary setup/cleanup
   throw uses the operation wrapper so application error objects are never
   mutated. Ordinary sampled snapshot errors are outcomes, not ledger entries.
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

## Public family contradiction requiring reconciliation

`contracts/v1/check.ts:1554–1561` demands `same-domain Atom or Selector` and
emits: `family factory admission must remain Atom-or-Selector after State widens`.
`callback-capabilities.json:279–280` freezes that restriction. Recovery 849–851
instead explicitly includes `family((key) => externalAtom(...))`, as does this
implementation brief. Recommendation: approve a narrow widening to Atom,
Selector, or ExternalAtom, while arbitrary collection State admission remains
rejected. Keep Atom-only override retention/reacquisition unchanged. This stops
only public family widening pending owner confirmation; internal model work is
unblocked. No other blocking contradiction has been identified.

## Engineering review

Scope is accepted as specified in the implementation brief: the five-slice
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
| E4 | `feat/external-atom-public` | E3 tip | approved contracts, root API, React/packed/GC/perf/docs/changeset |

The rows above are implementation slices, not separate landing PRs. The final
landing topology is exactly two PRs: `implement-external-atom` → `main`, followed
by `feat/external-atom-public` → the corrected model branch (retarget to `main`
after the model lands). E1–E4, including the E3.5 repair/extraction slice, stay
together in the implementation PR. No PR is opened, pushed, or merged by this lane.
Sequential implementation ownership of the StoreTree kernel. Independent agents
review contracts and recovery/test evidence only; they do not edit the kernel.

At this model-only checkpoint, the later runtime tasks belong to the second PR.

- [x] T1: implement independent external model and replayable trace protocol.
- [ ] T2: implement pull/capture/hydration using existing host seams.
- [ ] T3: implement sparse lifecycle and provisional registration.
- [ ] T4: implement outer settlement ledger and bounded delivery.
- [ ] T5: apply approved public decisions and certify all package/React gates.

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

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| Eng Review | `/plan-eng-review` | Architecture and test plan before edits | 1 | Internal model may proceed; public gate pending | existing evaluator reused; four implementation hazards already covered by brief |
| Independent review | contract/recovery audit agents | Evidence and conflicting authority | 2 | Model regressions addressed; public gate pending | family admission conflict confirmed; model counterexamples reproduced and tested |

VERDICT: E0 authorized; no production export or contract certification claim.

**UNRESOLVED DECISIONS:**
- Gate 0 items 1–5, including the operation-error wrapper and metadata shape.
- Narrow public family widening to include ExternalAtom.
