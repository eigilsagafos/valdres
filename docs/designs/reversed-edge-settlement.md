# Reversed-edge settlement and cycle recovery

Status: approved by the owner on 2026-11-05, after ShiftX validated candidate
`.5` (`valdres-reversed-edge-candidate-5.zip`, SHA-256
`98e6619a698e13b2b80bfbc26dad119b05abd871d1eb1833c5de0aa42ecc4065`). The
size-gate allowances, feature budgets and certified runtime digest below are
applied exactly as packaged in that candidate. The owner also accepted the
recovery and source-lifetime behavior described here, and retaining
`error.path` as the original diagnostic path. Catching and inspecting cycle
errors remain supported.

## Problem

ShiftX reported a false `SelectorCircularDependencyError` (packet
`valdres-reversed-edge-false-cycle`, SHA-256
`74e990087d8a0e83ef4acffec913020360d92f042755dda87a959d9d3379d756`).

One atomic commit reversed a dependency between cached selectors: P → S
became S → P. Committed settlement walks each queued selector's *old*
dependencies first. A new-graph read reached a selector whose own
old-dependency walk was still on the stack. Beta.46 then trusted a record
whose currentness it had not established, and a cycle proof followed the
obsolete edge.

A differential harness, comparing a cached Store against a fresh one, found
four variants of the same mistake. Rare stale *values* came from the same
cause.

Two pre-existing recovery defects belong to the same model. Both leave a
selector failed after a commit removes the cycle, and the fix covers them:

- **The edge-less latch.** A selector that detects a cycle (the *latch*)
  records only the reads before the closing one. Beta.46 never re-evaluated it
  until one of those reads changed.
- **The cold-read gap.** When a cycle closed during a cold read with the
  catching selector read first, subscriptions on the latch attached none of
  the cycle's external sources.

## Semantics

**Settlement.** `#settleSelector` returns what it established for the reading
session (`unproven`, `pending`, `cyclic`, `settled`) and folds it over the
old-dependency walk.
- A new-graph read evaluates any selector whose recorded edges may be
  obsolete.
- An edge into the reader's own evaluation is a real cycle and keeps the
  baseline blame (`selector-graph-semantics` causal-blame contract).
- An install that read a superseded token is requeued.
- A nested settlement session links to its outer session. Both its transient
  adjacency and its reverse proofs include the outer frames' accepted reads.

**What invalidates a cycle failure.** A latch's failure is a fact about
*reads*, not values. It holds while the latch's prefix reads are unchanged and
its closing read still reaches it through committed reads. The scope watches
the reported cycle plus a *route*, a committed path back to the latch. When a
watched selector installs without its successor:

- **It read differently.** A value's reads are complete, and a changed read
  order is a new topology. The latch is reopened.
- **It failed earlier along the same reads.** Its later reads are unobserved,
  not removed. The reported cycle is kept, and the route is repaired from
  other committed reads when one remains. The latch is reopened only if none
  remains.

Values, fallbacks and failures that keep the reads never reopen a latch.

**Termination.** A reopen consumes a real topology change. Selectors whose
reads depend on the latch's outcome must read the latch to observe it, so they
keep a route back to it. Fresh fallback objects change tokens, never reads.
There is no retry limit.

This is the reasoning behind the tested shapes, **not a universal proof**.
The evidence is bounded testing:
- the reviewers' reproductions in supervised child processes;
- the maintained primitive, stable-object and fresh-object fallback tests;
- a catch fuzz of 1,000 seeds × 8 commits;
- a 76-configuration differential sweep.

No new restriction on selectors is introduced.

**Diagnostics and recovery tracking are separate.** `error.path` is the cycle
as it was detected. It stays on the cached error while the cycle persists, even
if a selector on it now fails before reaching the read the path names.
Recovery follows the separately tracked route, so a retained path never delays
recovery. A path whose edge was really removed is re-derived.

**Source ownership.** Only subscription roots own external-source
subscriptions. Every record carries `cycleInClosure`: it is a cycle failure,
or a dependency or watched selector has the flag. A flagged record never owns
a flagged selector. It walks through them and owns only the unflagged
selectors and sources it reaches. This keeps lifecycle reference counts
acyclic, even when a selector catches the cycle error and returns a value.

So sources attach while a subscription reaches the cycle, and detach exactly
once when the last such subscription ends. Disposing a scope also releases
whatever its records still hold. A first install carries its flags to
dependents and watchers that already exist, which only happens when a cycle
closes during that very read. This covers cold reads without any rescan.

## Behavior accepted by the owner

Relative to `valdres@1.0.0-beta.46`:

- **Recovery.** A selector latched on a cycle recovers when a commit changes
  what a selector on the cycle reads. Its subscribers are notified once, also
  when the catching selector's value stays equal.
- **Persisting cycles are left alone.** Commits that change values or
  failures along a persisting cycle without changing its reads do not
  re-evaluate the latch or notify its subscribers.
- **Source lifetime.** External sources read along a cycle stay subscribed
  while any subscription reaches the cycle: the latch, a member, a catching
  selector or a dependent. They unsubscribe when the last such subscription
  ends or the Store or scope is disposed. Beta.46 never subscribed them for
  latch or dependent subscriptions.
- **Diagnostic paths.** `error.path` is retained as the original diagnostic
  path, as described above.

## Review record

**Candidates.** Five candidates were frozen with SHA-256 hashes and kept as
regression controls: `.1`, `.2`, `.3`, `.4` (`e5abe78b…`) and `.5`
(`98e6619a…`). Two independent reviewers audited the candidates.

**Reviewer 1** (oracle, ordering, proof and lifecycle reviews):
- **R1:** a recovery regression in `.1`.
- **R2:** a nested-session reverse proof that disagreed with canonical
  traversal, present through `.2`.
- **N1:** a caught fresh-object fallback looped `Store.set`, in `.3`.
- **N2:** caught-cycle sources leaked past unsubscribe and disposal, in `.3`.
- **E3:** an equal fallback hid a cycle's removal, pre-existing.

**Reviewer 2** (model-based oracle and fuzzing):
- independently confirmed the N2 leak;
- found the cold-read attach gap, pre-existing, which `.5` fixes.

Both reviewers cleared `.5` with no blocker remaining.

**The designs that changed.**
- Candidate `.3` reopened a latch on member *publications*. That conflated
  values with topology, causing N1 and E3.
- It also owned catching selectors from the latch, so lifecycle counts were
  cyclic (N2).
- An edge-precise reopen, tried before `.4`, re-attributed blame. A
  reroute-always rule left stale paths.

**Maintained coverage**, all in `packages/valdres/test`:

| File | Tests | What |
|---|---|---|
| `reversed-edge-settlement.test.ts` | 23 | the four causes and the packet shape |
| `reversed-edge-differential.test.ts` | 5 | fresh-Store differential |
| `reversed-edge-sources.test.ts` | 11 | collection-row and external-source reversals |
| `reversed-edge-cycle-watch.test.ts` | 17 | watch lifetime, isolation, bounds, retention |
| `reversed-edge-caught-cycles.test.ts` | 48 | fallback kinds, equal-value removal, ownership, cold reads, route vs reads |
| `linked-session-proofs.test.ts` | 2 | the R2 seams |

The beta.40 reversal suite, the causal-blame contract and every
error/notification-order contract pass unchanged.

## Measurements

- **Sweep.** 76 configurations: atom, collection and external rows (dormant
  too), cycles on and off.

  | Metric | Result |
  |---|---|
  | Checks | 7,380,559 |
  | Failures | 0 |
  | Missed cycles | 0 |
  | Post-cycle mismatches | 0 |
  | Reported cycle paths naming an edge the current graph lacks | 0 of 352,842 |

- **Reviewers' harnesses** on `.5`, unchanged:

  | Harness | Result |
  |---|---|
  | Bounded campaign | 7,684 cases |
  | Cycle oracle | 2,832 cases |
  | Ordering matrix | 864 cases |
  | Model fuzz | 2,400 seeds |
  | Obsolete-path break-and-recover continuations | 814 |
  | Catch fuzz | 1,000 seeds |

  All have 0 failures.
- **Cost** (candidate `.4`, in-process interleaved A/B against beta.46, both
  load orders, macOS arm64):
  - Node 24.16: within ±2%;
  - Bun 1.4.3: +1–4% on ordinary and rewiring lanes. The local noise floor is
    about ±5%.

  Candidate `.5` changes only first installs in stores with external atoms,
  and was not re-measured.

## Approvals (applied)

The protected proposal was measured on candidate `.5`, whose runtime equals
this change. It was packaged as `source/size-and-digest-proposal.patch` in
`valdres-reversed-edge-candidate-5.zip` (patch SHA-256
`a3e21baa40c14b05771fb6f512dc5836349992aaa675cfc721df0c4b37f952b2`), approved
by the owner on 2026-11-05, and is applied unchanged:

- **`scripts/size-baseline.json` allowances.** `coreRetainingRawAllowance`
  6155 → 9764 and `coreRetainingGzipAllowance` 2464 → 3611. These are the
  exact overage of `atom-selector-store` (76,048 / 20,880) against its
  immutable 2% ceilings (66,284 / 17,269).
- **Feature budgets**, set to the measured values (raw / gzip):

  | Budget | raw / gzip |
  |---|---|
  | dist | 405,242 / 120,546 |
  | packed | 566,506 / 153,415 |
  | collection | 119,549 / 34,171 |
  | query and query-development | 125,977 / 36,231 |
  | all-exports | 153,361 / 43,954 |
  | inspect | 113,815 / 31,084 |
  | root-deep-equal | 14,203 / 4,518 |
  | external-atom | 98,160 / 27,061 |

- **Digest.** `certifiedRuntimeBuildSha256` is
  `d36a4a066602df9bd0716d460a8d2043ad4f255dedeaaf57f41d5433d090b422`.

`scripts/toolchain-version.test.ts` pins the two allowances. The immutable
ordinary baselines are unchanged, and `atom`, `family` and `adapter-internals`
stay within their ceilings.

Rationale: the core growth is the settlement currentness fold, install
verification, the linked-session proofs and the cycle watch with route
tracking. The external-atom bundles also carry the cycle-aware ownership walk
and disposal release.

## Consumer acceptance

ShiftX validated candidate `.5` successfully. That was the owner's acceptance
condition for this change.
