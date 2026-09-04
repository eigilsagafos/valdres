# Valdres selector-kernel tournament

- Status: normative tournament specification and foundation work order
- Control release: `valdres@1.0.0-beta.36`
- Control source commit: `1c03f126ba714d0765c3386e613f4c892b89829b`
- Control `packages/valdres/src` tree:
  `35a20a12ff1087140b08622f9057c857900d17e5`
- Historical diagnostic: `valdres@1.0.0-beta.35` at
  `1d565045859e0787a164ac491e97d1069ad687ec`
- Normative fixture inventory:
  [`fixture-manifest.v1.json`](../../packages/valdres/test/selector-kernel-tournament/fixture-manifest.v1.json)
- Normative report schema:
  [`candidate-report.schema.json`](../../packages/valdres/test/selector-kernel-tournament/candidate-report.schema.json)

## Decision

Run a four-implementation selector-kernel tournament from one merged,
candidate-neutral foundation:

1. beta.36, unchanged, as the shipping control and family-inclusive substrate;
2. one frozen incumbent-lite ablation;
3. one reactive/currentness spike;
4. one dynamic-topological spike inspired by Pearce-Kelly.

Contract C is a cheap exploratory admission gate. Contract A is the observable
qualification contract. A candidate cannot ship, define a shared kernel seam, or
reach ShiftX from C alone. Promotion requires Contract A, the synthetic
performance and resource gates, and paired ShiftX validation.

No model gets a vote. Cross-model reviews may identify a defect, missing case,
or unsupported claim. A finding changes a candidate decision only when it is
converted into reproducible evidence, a gate failure, or an explicitly recorded
human decision. Agreement between models is not evidence of correctness.

## Goals

- Preserve beta.36 as the shipping control while testing simpler or more
  principled kernels.
- Judge every implementation against the same semantics, workloads, statistics,
  and artifact checks.
- Put selector-body, currentness, proposal-installation, edge-maintenance, and
  settlement costs inside the score. Cycle search is not a separate optimization
  program.
- Learn the host responsibilities each working implementation actually needs
  before extracting an internal boundary.
- Preserve the already-shipped `family()` product lane as frozen compatibility
  surface, not candidate scope or tournament score.

## Non-goals

- No candidate implementation belongs in this specification branch or the
  foundation branch.
- No public kernel interface, strategy object, runtime flag, or stable
  experimental subpath is designed here.
- No generic inspection API is redesigned here. Candidate evidence adapters are
  build-only test code, not a proposed production seam.
- No candidate is tuned to ShiftX alone, and no new cycle-proof heuristic tier
  is admitted.
- No family or collection behavior is made contingent on the tournament.
- No beta number is reserved in a branch name, PR title, or source manifest.

## Governing rules

The words MUST, MUST NOT, REQUIRED, and MAY are normative.

1. The foundation commit is merged before candidate workspaces are created.
2. Every candidate branch starts at the exact same foundation commit.
3. Candidate branches MUST NOT edit the manifest, semantic oracle, workload
   implementations, statistical policy, report validator, or control baseline.
   They also MUST NOT edit `family()` implementation, documentation, public
   expectations, or frozen tests.
4. Timings use separately packed, production, uninstrumented artifacts. A
   counter build never contributes a latency sample.
5. An implementation that fails semantics or provenance is killed before its
   performance is interpreted.
6. A missing, crashed, timed-out, or selectively discarded sample is not a fast
   sample. The lane fails provenance or is rerun in full under a new run ID
   after a documented environmental invalidation.
7. Intended win lanes are declared and hashed before the first candidate timing
   run.
8. Gate or fixture defects are fixed on a foundation-amendment branch. Every
   candidate rebases onto the merged amendment and all earlier evidence is
   invalidated.
9. Candidate code never enters the root bundle through a runtime switch. Each
   branch produces one build-time-specialized artifact.
10. Family compatibility is a non-scoring Contract A gate. It cannot satisfy an
    intended-win requirement or break a tie between candidates.
11. The tournament may return "no winner". Beta.36 remains shipping in that
    case.

## Tournament state machine

```text
origin/main @ beta.36
  (beta.35 selector lineage + shipped family substrate)
        |
        v
spec + frozen manifest + report schema
        |
        v
merged candidate-neutral foundation
        |
        +----------------+----------------+------------+
        |                |                |
        v                v                v
 incumbent-lite C    reactive C      dynamic-topo C
        |                |                |
        +---- useful signal + Contract C -+
                         |
                         v
              survivor-specific Contract A
                         |
                         v
          synthetic performance/resource screen
                         |
                         v
          candidate vs beta.36 paired ShiftX run
                         |
                         v
             finalist vs pre.28 paired run
                         |
                         v
        derive smallest internal boundary from
        beta.36 plus at least one working alternative
                         |
                         v
           integrate on current origin/main and
                    rerun every gate
```

## The four implementations

### Beta.36 control

The control is the runtime source tree at
`1c03f126ba714d0765c3386e613f4c892b89829b`. Foundation-only test and harness
changes may exist in its checkout, but the runtime tree hash MUST remain
`35a20a12ff1087140b08622f9057c857900d17e5`. It is built afresh with the same
toolchain and command as each candidate. A historical tarball is not a
substitute for this paired control artifact.

Beta.36 retains the beta.35 selector-kernel lineage while adding the merged
`family()` substrate, including its supplied-read capability guard. Beta.35
remains an optional historical diagnostic only. A comparison against beta.35
cannot qualify, eliminate, promote, or select a candidate and lives outside the
authoritative candidate report.

`valdres@0.2.0-pre.28` is a separate external claim baseline, not a semantic
control. The manifest freezes its npm integrity, shasum, tarball SHA-256, and
registry `gitHead`. A report may name it only with `baselineId: pre28-claim`,
after the beta.36 ShiftX gate passes; it cannot qualify a candidate or replace
beta.36 in any protected comparison.

### Frozen incumbent-lite

Incumbent-lite is defined before measurement. It retains:

- active-stack recursion detection;
- canonical, first-read-ordered forward DFS for positive path construction;
- graph-version and accepted-prefix revalidation;
- exact added-edge observation and topology-delta replay;
- active transient-prefix substitution;
- authoritative reverse edges required for propagation.
- beta.36's `family()` capability guard, definition callback quarantine, and
  other family-owned host behavior.

It removes:

- `SelectorNewEdgeProofMemo`;
- its admission, passive-learning, consultation, reset, and cross-version state;
- bounded reverse cycle proofs;
- topology-delta transient reverse snapshots and their proof policy.

The branch records one binary patch against the foundation commit before any
timing. It has no runtime flag, workload-specific branch, new search budget, or
post-result tuning constant. Any change to that patch starts a new candidate
revision and invalidates its earlier evidence.

### Reactive/currentness spike

This spike may change invalidation, currentness, propagation, evaluation-session
ownership, and settlement. It is not constrained to the existing evaluator
override. It must still use the existing public constructors and Store API in
its packed artifact. Its actual host-hook inventory is evidence; this document
does not prescribe its eventual internal boundary.

### Dynamic-topological spike

This spike may maintain a dynamic topological order across accepted selector
edges and may use provisional adjacency, rollback, or candidate-local rank
state. Pearce-Kelly is inspiration, not a correctness waiver or mandated
implementation. The spike must account for insertion, removal, transient active
edges, scopes, lifecycle, and positive path recovery in Valdres itself.

## Contract C: exploratory admission

Contract C exists to let an idea fail cheaply. It is intentionally weaker than
the shipping contract.

### C1. Completion and containment

- Every C semantic case MUST exit normally within its fixture timeout.
- A hang, process crash, stack overflow, unhandled rejection, or work that
  continues after the prescribed microtask/macrotask drain is an immediate
  failure.
- Selector, comparator, transaction, subscriber, and hydration callbacks MUST
  remain inside the existing control-fault quarantine. A caught control fault
  cannot become a value.

### C2. Cycle safety

- The authoritative committed dependency relation MUST be a DAG after every
  public operation, including a failed one.
- A cyclic candidate edge MUST never be installed. This is the no-false-negative
  rule.
- A rejected cycle MUST throw the exported `SelectorCircularDependencyError` and
  expose a valid closed directed path. Contract C does not require beta.36's
  exact blame or DFS tie-break.
- The exhaustive small-graph fixture enumerates every labeled DAG with one to
  five selectors and every possible next edge, including self edges. The
  independent reachability oracle decides whether that insertion closes a cycle.
  Both false negatives and false positives fail.

### C3. Minimum Store semantics

- The C trace subset MUST produce the frozen final values, errors, checksums,
  transaction status, and notification count/order in the manifest.
- A source mutation accepted before a derived failure remains final.
- An aborted scratch transaction publishes no value, dependency, or
  notification.
- Root, child, sibling, scratch, and hydration hosts cannot create cross-host
  dependency edges.
- Caught cycles remain failures for that one evaluation, and later supplied
  reads do no work.

### C4. Exploratory performance signal

Before timing, the candidate declares one to three intended workload IDs. It
then runs eight balanced fresh-process pairs per required C lane.

A C candidate advances only when:

- at least one declared intended lane has a paired location estimate at or below
  `0.85x` beta.36 and its 90% interval is wholly below `1.00x`;
- every C-protected ordinary lane has an estimate at or below `1.20x` beta.36;
- every timed process passes its checksum and public-work assertions;
- the timing artifact is uninstrumented and all provenance checks pass.

An intended result whose interval crosses `1.00x` is inconclusive, not a pass.
C-stage p95, heap, gzip, and code metrics are reported on day 3, but only the
hard safety, provenance, and signal rules above admit the candidate to A.

### C5. Authority limit

A C survivor MUST NOT ship, reach ShiftX, become a package export, define the
shared internal seam, or be described as a winner. Contract C says only that the
idea is safe enough and promising enough to finish.

## Contract A: observable qualification

Contract A preserves public behavior and causal cycle blame without freezing
beta.36's session choreography, memo policy, graph representation, or exact DFS
choice among several valid paths.

### A1. Authoritative graph and causal rejection

For an attempted dependency edge `P -> D`:

- the committed graph before the attempt is a DAG;
- if `D` can reach `P` in the effective committed-plus-transient graph, `P -> D`
  is the causally closing edge;
- that edge is rejected and absent from `P`'s installed dependency record;
- all earlier still-valid dependencies of `P` remain installed in their first
  read order, deduplicated;
- the graph after the failed evaluation is still a DAG;
- the thrown error is `SelectorCircularDependencyError` blamed on `P`;
- its path starts and ends at `P`, uses `P -> D`, follows valid effective graph
  edges back to `P`, and contains no repeated interior vertex;
- when several return paths are valid, any one may be chosen, but the same
  artifact, fixture, runtime, and seed MUST choose the same path on repeated
  runs.

The reported path contains the rejected edge as evidence. The authoritative
dependency record excludes it.

### A2. Sticky failure, prefix repair, and retry

- The first cycle caught during one selector evaluation remains that
  evaluation's exact error object even if selector code catches it, throws
  something else, or returns a value.
- Every later supplied `get` in that evaluation fails without evaluating or
  accepting the requested dependency.
- A later foreign publication may shorten an already accepted prefix at the
  first newly invalid edge. It cannot replace the first latched error.
- A successfully completed child may remain authoritative when its active parent
  fails. A partial active-parent result may not.
- A later public read retries through the retained accepted prefix. It may
  recover after the causal cycle is removed and must then replace the attempted
  record normally.

### A3. Currentness and publication

- Current selectors do not re-enter their bodies without an invalidating cause.
- Same-session nested publication and fresh-session publication both preserve
  DAG safety. An implementation may achieve this through different session or
  currentness machinery.
- Dynamic rewiring cannot reuse a stale child, token, dependency list, rank, or
  path certificate.
- Root, scope, transaction scratch, and hydration coordinates remain isolated
  even when they contain the same selector identity.

### A4. Values, errors, and equality

- Every contract trace has the same final value/error sequence as its
  hand-authored expectation or independent oracle.
- `Object.is` defaults, custom comparator calls, last-success baselines, equal
  value pruning, and recovery from an ordinary error remain unchanged.
- Repeated reads of an unchanged current error preserve object identity where
  the beta.36 contract does. Identity is compared as an equivalence relation
  within an artifact, never by cross-process object address.
- Returned or thrown thenables, invalid comparator results, hostile accessors,
  and revoked supplied getters keep their existing named errors and fault
  precedence.

### A5. Source commits, transactions, and hydration

- A valid source commit is final even when post-apply selector settlement
  produces a control or cycle error.
- A transaction exposes staged values through its scratch selector host, commits
  one final state on success, and publishes nothing on abort.
- Scratch errors and dependencies die with the draft generation.
- Hydration evaluation is disposable, uses server/fallback leaves as specified,
  does not publish into the live selector graph, and does not invoke live
  comparator baselines.

### A6. Notifications and callback order

- Final notification membership, multiplicity, synchronous delivery, and
  first-reaching/insertion order match the expected trace.
- Equality-pruned selectors do not notify dependents.
- Dynamic rewiring retains the established old-dependency ordering rules.
- Subscriber failures are isolated and reported with the same public error
  precedence. A callback cannot mutate a quarantined same-domain Store.
- No notification appears after the fixture's microtask/macrotask drain.

### A7. Async settlement and lifecycle

- Promise value/error settlement, supersession, stale settlement rejection,
  disposal, and cancellation preserve the final observable outcome and
  notification trace.
- Scope disposal removes the complete owned subtree and its routing. Recreating
  a named scope cannot reuse a dead selector record, subscription, rank, or
  candidate-specific queue node.
- Released candidate state must not remain strongly retained after the existing
  GC drain protocol.

### A8. Evidence without an interface commitment

Each candidate supplies a build-only evidence adapter that translates its own
state into the neutral trace fields required by the fixture runner:

- accepted ordered selector dependencies;
- current value/error identity token;
- host coordinate and lifecycle generation;
- logical evaluation outcome offered to the host;
- logical authoritative record acceptance;
- common counters defined below.

The adapter may be different for every candidate. It is omitted from timed and
published builds. Its shape is a test observation protocol, not a kernel API or
an extraction target.

### A9. Shipped family compatibility

`family()` is not a candidate and contributes no intended-win or tie-break
metric. It is nevertheless shipped beta.36 behavior and therefore a required,
non-scoring compatibility gate:

- all frozen public family tests MUST pass without changed expectations;
- family-created Atoms and Selectors remain ordinary same-domain State handles
  under every candidate kernel;
- family definition callbacks retain their synchronous capability quarantine,
  including rejection of borrowed selector-supplied reads and sticky fault
  precedence;
- candidate code MUST NOT edit family implementation, docs, public contracts,
  tests, or package surface;
- a family compatibility failure eliminates the candidate before performance is
  interpreted, but family performance cannot qualify or rank it.

## Workload inventory

The companion manifest owns IDs and parameters. A rename or parameter change is
a schema-version change and invalidates prior evidence.

### Semantic fixture groups

| Group                                                | Required at C | Required at A | Authority                                       |
| ---------------------------------------------------- | :-----------: | :-----------: | ----------------------------------------------- |
| active direct/indirect cycles                        |      yes      |      yes      | independent selector oracle plus explicit trace |
| cached reversal and multi-hop cycles                 |      yes      |      yes      | independent selector oracle                     |
| exhaustive DAG edge insertion, 1-5 nodes             |      yes      |      yes      | independent reachability enumeration            |
| causal blame, prefix retention, sticky caught fault  |    subset     |      yes      | explicit invariant validator                    |
| same-session/fresh-session/finalization publication  |      no       |      yes      | explicit Store trace                            |
| value, ordinary error, equality, error identity      |    subset     |      yes      | explicit Store trace                            |
| source finality and completed-child retention        |      yes      |      yes      | explicit Store trace                            |
| transaction scratch commit/abort                     |      yes      |      yes      | explicit Store trace                            |
| scope isolation, inheritance, disposal/recreation    |      yes      |      yes      | explicit Store trace                            |
| notification membership/order and callback isolation |      yes      |      yes      | explicit Store trace                            |
| hydration isolation and missing-reader fault         |      no       |      yes      | explicit adapter trace                          |
| async settle/supersede/dispose                       |      no       |      yes      | fake-clock trace                                |
| shipped family compatibility                         |      no       |      yes      | frozen public tests plus capability trace       |
| deterministic generated differential traces          |      no       |      yes      | fixed seeds and independent oracle              |

The normalized trace compares exact public outcomes and order. Cycle paths are
validated structurally under A1 instead of byte-compared to beta.36. Candidate
specific counter namespaces are never part of semantic equality.

### Decision-bearing performance lanes

| ID                         | Shape                       | Frozen parameters                                              | Why it exists                                      |
| -------------------------- | --------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| `P-NEG-ATOM-2048`          | atom-only negative control  | 2,048 atoms, 20 commits, 128 writes/commit                     | proves the selector kernel stays off the atom path |
| `P-FANOUT-128`             | stable selector fanout      | 128 selectors, 20 source commits                               | small fanout floor                                 |
| `P-FANOUT-512`             | stable selector fanout      | 512 selectors, 20 source commits                               | middle scaling point                               |
| `P-FANOUT-2048`            | stable selector fanout      | 2,048 selectors, 20 source commits                             | wide settlement and proposal cost                  |
| `P-REWIRE-SEPARATE-181-18` | ordinary separate commits   | 181 items, 18 sequences, 6 subscribers/item, 20 genuine moves  | ShiftX-sized ordinary lane                         |
| `P-REWIRE-SEPARATE-800-2`  | ordinary separate commits   | 800 items, 2 sequences, 6 subscribers/item, 20 genuine moves   | long-chain per-evaluation pressure                 |
| `P-REWIRE-TXN-181-90`      | one rewiring transaction    | 181 items, 18 sequences, 90 changed items, 6 subscribers/item  | medium topology batch                              |
| `P-REWIRE-TXN-800-400`     | one rewiring transaction    | 800 items, 18 sequences, 400 changed items, 6 subscribers/item | reverse-wide topology batch                        |
| `P-GRAPH-FWD-WIDE-2048`    | forward-wide/reverse-narrow | 2,048 selector leaves, 20 new-edge toggles                     | charges forward closure work                       |
| `P-GRAPH-REV-WIDE-2048`    | reverse-wide/forward-narrow | 2,048 incoming watchers, forward depth 16, 20 new-edge toggles | charges reverse/order-maintenance work             |
| `P-CORE-INITIAL-VIEW`      | packed cold initial view    | existing `initial-view-core` fixture                           | first materialization and subscription             |
| `P-CORE-WRITES`            | packed ShiftX-shaped churn  | existing `writes` fixture, 900 steps                           | read/sub/unsub/write integration                   |
| `P-CORE-NO-WRITES`         | packed lifecycle control    | existing `no-writes` fixture, 900 scroll steps                 | proves churn without mutation work                 |
| `P-SCOPE-1000`             | scoped propagation          | existing 1,000-scope no-shadow case                            | scope-qualified routing cost                       |
| `P-SUB-CHURN-100`          | subscription churn          | existing 100 shared selector pairs                             | mount/unmount ownership cost                       |
| `P-SCRATCH-SET-READ`       | transaction scratch         | existing staged set plus selector read, aggregated to >=1 us   | scratch currentness/evaluation cost                |
| `P-HYDRATE-2048`           | disposable hydration        | 2,048 selectors over 512 leaves, 20 snapshots                  | hydration host cost and isolation                  |
| `P-ASYNC-SETTLE-OBSERVED`  | async settlement            | existing observed native selector settlement                   | settlement queue and callback cost                 |

Every lane asserts a deterministic public-work count and checksum before its
sample is admitted. The foundation commit freezes the new checksums. Existing
core-load fixtures are reused byte-for-byte:

- `fixture.v1.json` SHA-256
  `bc0e260b35d3deef4dbda8324d35e8eb409b7dd8625f2520ccda2c81aafb7c7a`
- `initial-view-core.v1.json` SHA-256
  `7b6a1033baa3aa8bd54b586b71cb201506d167c4d34fc393f39c552c9b3c4cff`

The 181/18 separate-commit port MUST use a guaranteed cross-sequence move
`target = (current.seq + 1) % sequences`; the earlier `(move * 5) % sequences`
formula performed three topology-preserving writes. Both rewire families use an
explicit structural number-array comparator so equality behavior is fixed across
all four implementations.

### Common counter meanings

These names have identical logical meanings even when a candidate allocates no
object with that name:

| Counter                  | Exact meaning                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `selectorBodyEntries`    | entries into a user selector body, including committed, scratch, and hydration hosts                                 |
| `suppliedGets`           | invocations of the selector-supplied `get`, including repeats and calls rejected by a sticky fault                   |
| `serveCalls`             | supplied gets that reach host currentness/serve work after active-recursion and sticky-fault checks                  |
| `proposalsReturned`      | complete logical selector outcomes offered for host acceptance, allocation-free implementations included             |
| `proposalsInstalled`     | authoritative selector-record acceptances, including equal/topology-identical logical publications                   |
| `dependencyEdgesAdded`   | set additions from the old authoritative selector dependency set to the accepted set; reordering alone is not an add |
| `dependencyEdgesRemoved` | set removals from the old authoritative selector dependency set; lifecycle graph clear counts each live edge once    |
| `notifications`          | final changed targets selected for notification                                                                      |
| `subscriberCallbacks`    | actual callback invocations; duplicate subscriptions count separately                                                |
| `publicOperations`       | manifest-named public API operations inside the workload                                                             |
| `checksum`               | workload-defined deterministic final public outcome digest                                                           |
| `retainedHeapBytes`      | bytes retained after the prescribed drain and full-GC sequence                                                       |

Canonical search, reverse proof, memo, reactive queue, topo relabel, rank
repair, and rollback counters live under candidate-specific namespaces. A report
MUST NOT compare an unqualified counter named `visits` across kernels.

## Timing and statistics

### Experimental unit

One process is one observation. Import, package resolution, graph definition,
and fixture validation happen outside the timed window unless the manifest says
the operation is the workload. There are no warmup processes. In-process warmup
or tier-settle windows are allowed only when the existing benchmark defines
them, and every discarded tier window remains in the raw artifact.

For each pair `i`, run one control process and one candidate process. Pair order
alternates:

```text
pair 1: control -> candidate
pair 2: candidate -> control
pair 3: control -> candidate
pair 4: candidate -> control
...repeat...
```

No other candidate runs between the two arms of a pair. Candidate order across
whole lanes is rotated with a recorded seed.

### Reported summaries

For every arm and lane, retain all unrounded process observations and report:

- ordinary p50;
- nearest-rank p95;
- sample count and every failed/missing observation;
- paired ratios and log-ratios;
- Hodges-Lehmann location of `ln(candidate/control)`, exponentiated as the
  headline ratio;
- the existing Winsorized/Yuen standard error with its resolution floor;
- an unadjusted two-sided 90% interval for readability;
- named one-sided test results for protected non-regression and intended wins,
  each with its own null ratio, p-value, Benjamini-Hochberg q-value, and status;
- bimodality, batch-size-shift, tier-unsettled, and unpaired flags.

This extends the implementation in `scripts/lib/paired-decision.ts`; it does not
create a second estimator. The foundation must add policy parameters and
calibration tests before the tournament runner can produce a passing verdict.

### C screen

- Eight fixed pairs per lane.
- Intended signal: estimate `<= 0.85`, 90% interval upper bound `< 1.00`.
- Ordinary-lane screen: estimate `<= 1.20`.
- No multiple-comparison claim is made from C. It is an admission screen only.
- A result that does not establish the intended signal is `inconclusive` and
  does not advance.

### A synthetic qualification

- Twenty-four fixed pairs for every non-core-load lane on every manifest-named
  runtime.
- Fifty fixed pairs for each packed core-load lane, preserving its existing
  authoritative protocol.
- Protected non-regression family: for every candidate, all protected
  lane/runtime rows must reject `ratio >= 1.10` in favor of `ratio < 1.10` at
  BH-adjusted `q <= 0.05`. Merely failing to prove a regression is not a pass.
- Intended-win family: at least one predeclared intended row must have estimate
  `<= 0.85` and reject `ratio >= 1.00` at BH-adjusted `q <= 0.05`.
- Tail gate: candidate p95 divided by control p95 MUST be `<= 1.20` on every
  process-level protected lane.
- Existing absolute core-load ceilings, deterministic architecture counts, and
  checksum gates still apply.
- Any protected row that cannot establish non-regression is `inconclusive` and
  blocks promotion. There is no selective sample extension.

The BH family is one candidate across every protected workload/runtime row for
one direction. Intended rows form a separate, predeclared family. Diagnostic
rows are reported but cannot rescue or fail a candidate.

Every timing row therefore carries separate `protectedNonRegression` and
`intendedWin` decision records. A decision that does not apply is explicitly
`null`; one `pValue`/`qValue` pair may never stand in for both families. The
manifest-aware validator checks the row's stage, `protected`/`intended` flags,
null ratio, family membership, and decision status together.

### Environment invalidation

Environmental invalidation applies to a whole lane run, never one inconvenient
sample. Valid reasons are recorded AC-power loss, thermal-pressure transition,
OS update/restart, competing benchmark process discovered from the process
inventory, or runner failure before both arms complete. The replacement gets a
new run ID and the invalid run remains in the evidence bundle.

## Memory, size, and complexity gates

### Retained memory

- Run five alternating control/candidate pairs per manifest memory scenario.
- Each process uses the existing drain plus three full-GC protocol.
- Report retained bytes per unit and released residual bytes for every sample.
- Candidate median retained bytes per unit MUST be `<= 1.10x` control in every
  scenario and MUST pass the existing Bun and Node absolute ceilings.
- Released residual MUST pass the existing absolute ceiling. A monotonic
  retained increase across three post-release drains is an immediate failure.

The manifest freezes these eight scenarios from
`test/performance/architecture.memory.ts`; its hash and the duplicated values
below must agree before a run starts:

| Scenario ID                           | Unit (count)         | Bun retained / released | Node retained / released |
| ------------------------------------- | -------------------- | ----------------------- | ------------------------ |
| `M-ATOM-ONLY-STORES`                  | atom state (4,000)   | 160 B / 524,288 B       | 120 B / 262,144 B        |
| `M-LIVE-SELECTOR-GRAPHS`              | selector (1,500)     | 2,400 B / 524,288 B     | 1,500 B / 262,144 B      |
| `M-DYNAMIC-DEPENDENCY-CHURN`          | selector (1,000)     | 2,100 B / 524,288 B     | 1,400 B / 262,144 B      |
| `M-SCOPE-CREATION-DISPOSAL`           | scope (1,500)        | 3,200 B / 524,288 B     | 3,400 B / 262,144 B      |
| `M-SINGLE-STORE-TRANSACTIONS`         | staged state (2,500) | 360 B / 524,288 B       | 120 B / 262,144 B        |
| `M-DEEP-CROSS-SCOPE-TRANSACTIONS`     | depth level (64)     | 30,000 B / 524,288 B    | 14,000 B / 262,144 B     |
| `M-GLOBAL-FANOUT`                     | store (1,000)        | 3,700 B / 524,288 B     | 3,400 B / 262,144 B      |
| `M-STORE-DISPOSAL-ASYNC-CANCELLATION` | store (500)          | 7,500 B / 524,288 B     | 7,500 B / 262,144 B      |

Retained ceilings are bytes per unit; released ceilings are residual bytes per
process. At the memory-gated stages, the report has one row for every frozen
scenario/runtime pair. The foundation validator rejects missing, duplicate, or
unknown rows and any ceiling or unit-count drift.

### Built artifact size

Run the existing package-size measurement against separately packed control and
candidate tarballs with the same Bun version. Every current dist, packed, and
consumer-fixture gzip/raw metric MUST remain within the existing `+2%` shipping
budget relative to beta.36. Report improvements without ratcheting the
candidate-neutral baseline during the race.

The report also records root shared-chunk gzip (beta.36 baseline `17,349` bytes)
and packed-package gzip (beta.36 baseline `76,981` bytes). A candidate build may
not add an export or hide code behind an export condition to move bytes out of
the measured root graph.

### Implementation complexity

Complexity does not compensate for a failed semantic or performance gate. For
every candidate report:

- production lines added/removed by module;
- number and description of candidate-owned persistent state fields;
- number of algorithmic constants and the pre-measurement rationale for each;
- host-hook inventory with phase, lifetime, read/write effect, and timed-path
  frequency;
- candidate-specific tests and invariants;
- one frozen diff hash.

New workload-tuned constants, a second heuristic tier, or a public runtime
strategy switch are hard failures. After the C screen, one bounded,
profiler-driven correction is allowed. It creates a new revision and requires a
full rerun.

## ShiftX external validation

Only A-qualified candidates run in ShiftX. The application commit, browser,
production build flags, CPU throttle, data fixture, interaction script, and
trace parser are frozen before the first pair.

Required scenarios:

1. single-decision drop, pointer-up through the end of RunTask;
2. the fixed 15-step gesture with ShiftX's batching fix enabled.

Protocol:

- candidate vs `baselineId: beta36-control` first;
- eight balanced pairs, then four more only when a protected row is
  inconclusive, capped at twenty pairs;
- exact public result checksum and error/console audit on every run;
- signed Chrome profile `timeDeltas` from `Profile.startTime`; no chunk-count or
  sample-count normalization;
- candidate must establish the same `<=1.10x` non-regression rule and `<=1.20x`
  p95 rule for both scenarios;
- only after that pass, run finalist vs `baselineId: pre28-claim` with the same
  paired protocol and the manifest-pinned npm tarball.

The pre.28 comparison is a claim gate, not semantic authority. "Beats pre.28" is
permitted only when the paired estimate is below `1.00x` and its 90% interval is
wholly below `1.00x`. A single trace can never support that claim.

## Provenance contract

Every authoritative report contains and hashes:

- tournament ID, specification path/SHA-256/merge commit, fixture-manifest
  SHA-256, report-schema SHA-256, and foundation commit;
- control tag, commit, runtime tree, tarball, production entry, and complete
  `dist` tree SHA-256;
- candidate ID, revision, commit, clean status, runtime tree, frozen diff,
  tarball, production entry, and `dist` tree SHA-256;
- candidate plan hash, including intended workload IDs and every constant;
- exact build command, bundler/minifier and versions, flags, export conditions,
  package manifest, and lockfile hash;
- runner source and statistical implementation hashes;
- fixture, adapter, workload, expected-trace, and checksum hashes;
- Node, V8, Bun/JSC, OS version/build, architecture, hardware model, CPU,
  logical cores, memory, power source, and thermal observations;
- invocation, environment allowlist, UTC start/end, process ID, pair ID, arm
  order, exit status, and raw stdout/stderr digest for every process;
- semantic preflight evidence ID linked from every admitted timing sample;
- counter-build hashes, proving they differ from and were not used as timed
  artifacts;
- when the pre.28 claim runs, its package identity, registry integrity/shasum,
  registry `gitHead`, tarball SHA-256, production entry, and complete `dist`
  tree SHA-256;
- review artifact hashes and finding dispositions.

The benchmark repository and candidate worktree MUST be clean. Candidate build
metadata `gitSha` must equal candidate `HEAD`; a packed `gitHead`, when present,
must equal it. The control runtime tree must equal the frozen beta.36 tree even
when the harness lives at a later foundation commit.

## Candidate evidence bundle

An authoritative run writes one immutable directory:

```text
<evidence-root>/<foundation-sha>/<candidate-id>/<revision>/<run-id>/
├── candidate-plan.json
├── provenance.json
├── conformance-c.json
├── conformance-a.json
├── timings.ndjson
├── timing-decisions.json
├── counters.json
├── memory.ndjson
├── sizes.json
├── host-hooks.json
├── complexity.json
├── reviews/
│   ├── codex.md
│   ├── other-vendor.md
│   └── dispositions.json
├── report.json
├── report.md
└── SHA256SUMS
```

`report.json` MUST validate against `candidate-report.schema.json`. `report.md`
is a rendering of the same facts and contains no independent verdict field. Raw
process observations stay in `timings.ndjson`; summaries never replace them.

JSON Schema enforces the closed report shape and scalar domains. The
foundation's manifest-aware validator additionally enforces known and unique
case/workload IDs, stage completeness, gate/result consistency, candidate-to-
counter-namespace matching, required artifact membership, and every referenced
hash. Each timing row names `beta36-control` or `pre28-claim`, uses
baseline-neutral p50/p95 fields, and carries independent decision records for
the two BH families and the interval-only pre.28 claim. The pre.28 baseline
identity is `null` until that comparison is authorized. Neither a rendered
report nor a reviewer may set machine eligibility.

For local Conductor fanout, use a shared absolute evidence root under
`~/.gstack/projects/eigilsagafos-valdres/selector-kernel-tournament/`, not a
workspace-local `.context` directory. CI uploads the same directory as one
artifact. Candidate branches contain code; evidence directories contain runs.
Evidence is never cherry-picked between branches.

### Required report sections

1. Identity and frozen intent.
2. Gate summary with `pass`, `fail`, `inconclusive`, or `not-run` for every
   required gate.
3. First failing semantic/provenance item, if any.
4. Contract C, Contract A, and non-scoring family compatibility case matrices.
5. Protected and diagnostic timing tables with raw-artifact links.
6. Baseline ID, p50, p95, paired estimate, interval, separate hypothesis-family
   p/q decisions, flags, and sample counts.
7. Common counters followed by candidate-specific namespaces.
8. Memory and size results.
9. Complexity and host-hook inventory.
10. ShiftX results, when eligible.
11. Review findings and evidence-backed dispositions.
12. Machine-computed eligibility and human selection record.

## Supporting method references

- Kalibera and Jones,
  [_Rigorous Benchmarking in Reasonable Time_](https://kar.kent.ac.uk/33611/),
  is background for treating processes as observations and preserving raw
  multi-level timing evidence.
- Benjamini and Hochberg,
  [_Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing_](https://rss.onlinelibrary.wiley.com/doi/pdf/10.1111/j.2517-6161.1995.tb02031.x),
  is the source for the named FDR procedure used by the existing paired model.
- Pearce and Kelly,
  [_A Dynamic Topological Sort Algorithm for Directed Acyclic Graphs_](https://citeseerx.ist.psu.edu/document?doi=63b7c3a5fc3d36ecd96ea5f1e85344d92766309d&repid=rep1&type=pdf),
  is background for one spike family, not a mandated implementation.

These references inform the design; the frozen manifest, this specification, and
executable gate artifacts are the tournament authority.

## Promotion and winner selection

The report validator computes eligibility. A model-written summary cannot
override it.

1. Eliminate any provenance, Contract C, Contract A, family compatibility,
   protected performance, p95, memory, size, or ShiftX failure.
2. Eliminate any candidate with a required `inconclusive` result at its stage.
3. If exactly one alternative survives, it becomes the integration finalist.
4. If several alternatives survive, remove a candidate only when another is no
   worse on every protected timing/resource row within the measured resolution
   and decisively better on at least one, while using no more persistent state
   or host hooks. This is artifact-backed Pareto dominance.
5. If several non-dominated candidates remain, run direct paired comparisons on
   their declared intended lanes and both ShiftX scenarios. If they remain
   equivalent, prefer fewer required host hooks, fewer persistent state
   invariants, then smaller production diff, in that order.
6. If those recorded metrics still tie or conflict, retain beta.36 and report no
   winner. Do not break the tie with model consensus.

Beta.36 need not prove a 15% win over itself. It is the fallback, not a
candidate for promotion.

## Exact branch and file boundaries

### 1. Specification

Branch: `spec-selector-kernel-tournament`

Base: `origin/main` at `1c03f126ba714d0765c3386e613f4c892b89829b`

Owns only:

- this specification;
- `fixture-manifest.v1.json`;
- `candidate-report.schema.json`;
- `.changeset/selector-kernel-tournament-spec.md`, containing only empty YAML
  frontmatter as the repository's required non-release CI marker.

It MUST NOT change runtime source, tests, build scripts, package manifests,
lockfiles, workflows, or any release-bearing Changeset. The empty Changeset MUST
name no package and request no version bump.

### 2. Foundation

Branch: `test-selector-kernel-foundation`

Base: the merge commit of `spec-selector-kernel-tournament` on `origin/main`

Allowed paths:

- `packages/valdres/test/selector-kernel-tournament/**`;
- new tournament-only helpers under `packages/valdres/test/utils/**`;
- `scripts/selector-kernel-tournament/**`;
- candidate-neutral extensions and tests in `scripts/lib/paired-decision*`,
  `scripts/lib/robust-estimators*`, and benchmark result parsing;
- root or package `package.json` script entries only;
- one manual/dispatch-only tournament workflow and its tests, if needed;
- this document when implementation reveals a factual spec defect.

Forbidden paths:

- `packages/valdres/src/**`;
- `packages/valdres/build.ts`;
- public export maps or declaration surfaces;
- family implementation, docs, contracts, or frozen public tests;
- existing semantic expectations changed merely to match beta.36;
- package versions, lockfile, package changelog, and Changesets.

The foundation PR ends by freezing its merge SHA, runner hashes, expected
traces/checksums, and a green beta.36 control evidence bundle.

### 3. C-stage spikes

All three branches start at that exact foundation merge SHA:

- `spike-selector-kernel-incumbent-lite`;
- `spike-selector-kernel-reactive-currentness`;
- `spike-selector-kernel-dynamic-topological`.

Each owns only its implementation, candidate-local tests, candidate evidence
adapter, candidate plan, and generated external evidence. It may change
`packages/valdres/src/v1-internal/**` and the minimum private root wiring needed
to select its build. It MUST NOT change public signatures/exports, the shared
domain identity, normative tournament files, or another candidate's code. It
also MUST NOT edit family-owned source, documentation, public contracts, or
frozen tests. Family compatibility is inherited from the common beta.36 base.

Each new architecture spike is timeboxed to three focused days:

- day 1: Contract C semantics and cycle corpus;
- day 2: 181/800 separate-commit lanes plus dual graph-shape scaling, with the C
  performance signal;
- day 3: full C screen, p95, heap, gzip, complexity, and hook inventory.

One profiler-driven correction is allowed. A second correction or a new
heuristic tier ends the spike.

### 4. A qualification

Create only for a C survivor, from the same frozen foundation SHA:

- `qualify-selector-kernel-incumbent-lite`;
- `qualify-selector-kernel-reactive-currentness`;
- `qualify-selector-kernel-dynamic-topological`.

Cherry-pick the survivor's frozen candidate diff and its bounded correction, if
any. Do not merge the spike branch wholesale. Qualification may add
candidate-local tests and fixes required by Contract A; every code change makes
a new revision and requires a full evidence rerun.

### 5. Foundation amendment

Branch: `test-selector-kernel-foundation-fix-<issue-id>`

Base: current `origin/main` containing the foundation

Owns only the broken candidate-neutral fixture/runner/statistics change. Once
merged, every active spike or qualification branch rebases onto the new
foundation, receives a new foundation SHA, and discards all prior verdicts.

### 6. Mechanical packaging proof

Branch: `test-selector-kernel-packaging`

Base: the foundation merge SHA

May prove static split-entry isolation, shared `v1Domain` identity,
declarations, packed consumers, adapter/React compatibility, and root bundle
non-leakage. It MUST NOT choose public names, publish an entry, generalize
inspection, or contain a candidate algorithm. Nothing from this branch is
required until an A survivor needs external testing.

### 7. Internal boundary extraction

Branch: `internal-selector-kernel-boundary`

Base: current `origin/main` after at least one alternative passes A and the
synthetic screen

Inputs: beta.36 plus every A survivor's implementation and host-hook inventory.
This branch derives the smallest internal boundary needed by working code. It
does not create a public strategy API. All implementations rerun A and the
performance screen after extraction.

### 8. Winner integration

Branch: `integrate-selector-kernel-winner`

Base: then-current `origin/main`

Apply only the selected implementation and the reviewed internal boundary. Rerun
every semantic, performance, resource, packaging, and ShiftX gate because the
integration base differs from the frozen tournament base.

### 9. Shipped family product lane

Landed branch: `family-c1-product-lane`

Merge commit: `f61e6199f0199c192b3b3701e81c8a11d63ef38b`

Shipping substrate: `valdres@1.0.0-beta.36` at
`1c03f126ba714d0765c3386e613f4c892b89829b`

The product lane is complete and needs no tournament workspace. Its behavior,
docs, public contracts, and tests remain independently owned. Because it landed
before the foundation, every control and candidate starts from the same
family-inclusive beta.36 substrate.

The tournament freezes those family-owned paths. Candidate branches cannot
change them, use family performance as an intended lane, or use family metrics
to select a winner. Contract A runs the frozen family tests and focused
selector-capability traces only as compatibility gates. A family regression is
fixed outside candidate branches; candidate evidence is rerun afterward if the
shared substrate changes.

Collection work may proceed independently only while it does not couple to
selector-engine internals. Any such coupling waits for boundary extraction.

## Foundation work order

This is the first mergeable implementation PR after the specification. It
contains no candidate kernel.

### F0. Freeze normative inputs

- Validate the manifest and report JSON Schema.
- Assert the specification bytes match the manifest SHA-256 and record the
  specification merge commit separately in every report.
- Assert the beta.36 commit and runtime tree hashes.
- Assert existing core-load fixture hashes.
- Assert the pre.28 registry identity and tarball SHA-256 before any claim run.
- Assert all eight memory scenario names, units, runtimes, and absolute ceilings
  against the frozen architecture-memory source.
- Assert the complete size baseline and its measurement script hashes before
  comparing every existing raw/gzip metric.
- Assert the family merge, implementation, and frozen public-test hashes.
- Add a protected-path hash command used by every candidate report.

Verify: schema and manifest-aware tests fail on unknown IDs, duplicate IDs,
changed parameters, a mismatched specification hash, an ambiguous timing-test
family, a missing memory row, an unauthenticated pre.28 row, and a mismatched
control tree.

### F1. Build the artifact driver

- Pack production root artifacts from arbitrary clean commits.
- Drive only the existing `valdres` and adapter-internals public operations.
- Reject reference-model source, source-tree imports, instrumentation in timed
  mode, new exports, and a mismatched singleton domain.
- Produce independent timed and counter artifacts with separate hashes.

Verify: beta.36 root values, adapter reads, scopes, transactions, subscriptions,
hydration, and family-created states work from an installed tarball under Node
and Bun.

### F2. Build the candidate-neutral semantic runner

- Reuse `test/v1-model/selector-oracle.ts` for pure selector expectations.
- Add exhaustive 1-5-node DAG edge-insertion enumeration with an independent
  reachability implementation.
- Add hand-authored Store traces for currentness, publication, scope,
  transaction, hydration, notification, async, lifecycle, and error identity.
- Run the frozen public family suite and add the two manifest-named
  family-compatibility traces without changing family expectations.
- Accept candidate-owned evidence adapters without sharing their production
  hooks.
- Normalize values and within-run identities without serializing application
  objects.

Verify: the full beta.36 control passes; deliberately accepting a cyclic edge,
installing the offending edge, changing blame, losing prefix state, duplicating
a notification, leaking scratch state, or bypassing family callback quarantine
each produces the expected fixture ID.

### F3. Port and correct the workload corpus

- Port the 181/18 and 800/2 separate-commit repros with guaranteed genuine moves
  and structural sequence equality.
- Port the 181/90 and 800/400 single-transaction lanes.
- Add stable fanout, dual graph-shape, hydration, and atom-only cases.
- Wrap the existing scope, subscription, scratch, async, and packed core-load
  cases rather than duplicating them.
- Freeze exact work counts, semantic checksums, and timer boundaries.

Verify: a checksum or work-count mutation rejects the sample before statistics
run; `no-writes` still performs all 900 lifecycle steps.

### F4. Extend paired analysis for tournament policies

- Parameterize the existing paired decision code for the `1.10` budget and
  intended-win test without changing the current PR-gate defaults.
- Add fixed 8/24/50-pair protocols, p95 ratios, family assignment, and explicit
  `inconclusive` outcomes.
- Retain raw samples and existing noise flags.
- Calibrate with deterministic simulations, same-artifact A/A, and injected
  `+15%`, `+20%`, and bimodal slowdowns.

Verify: current `scripts/PAIRED_DECISION_MODEL.md` tests remain green; A/A does
not manufacture wins; injected regressions and intended wins cross only their
specified gates.

### F5. Add provenance and report validation

- Capture every provenance field in this spec before starting timing.
- Validate `report.json`; render `report.md` from it.
- Hash the complete evidence bundle and fail closed on missing files, unknown
  fields, dirty trees, mismatched SHAs, or selectively absent samples.
- Make intended-lane declarations immutable once a timing run exists.

Verify: tampering with a tarball, fixture, result row, intended-lane list, build
metadata, or `SHA256SUMS` fails with one precise error.

### F6. Reuse memory and size gates

- Run the current Bun/Node GC drain and absolute ceilings against both arms.
- Add paired retained-bytes reporting without weakening existing gates.
- Measure the exact packed control/candidate artifacts with the existing size
  script and record root reachability inputs.

Verify: a deliberately retained candidate node and a root-only import that
reaches candidate evidence code both fail.

### F7. Freeze the beta.36 control bundle

- Run all Contract C and A cases, all workloads, memory, size, and provenance
  checks on beta.36, including the non-scoring family compatibility gate.
- Run beta.36 vs itself to establish live runner noise.
- Record any fixture that beta.36 cannot satisfy as a foundation defect. Do not
  silently weaken the fixture or redefine the control.
- Optionally publish beta.35 results in a separate diagnostic bundle; they have
  no eligibility or selection field.
- Publish the green bundle and its `SHA256SUMS` at the shared evidence root.

### F8. Prove the gates red

Create test-only mutations that each fail exactly one class:

- false-negative cycle;
- false-positive cycle;
- offending-edge installation;
- wrong causal blame;
- non-sticky caught fault;
- notification reorder/duplication;
- scratch or hydration publication leak;
- family supplied-read quarantine bypass;
- candidate modification of a frozen family-owned path;
- timed instrumentation;
- provenance mismatch;
- deterministic 20% slowdown;
- retained-memory leak;
- root bundle leakage.

These mutations are fixtures, never candidate implementations.

### F9. Review and merge

- Run core, React, and frozen family tests, types, package/packed checks, memory
  lanes, and the tournament self-tests.
- Have an independent reviewer audit the oracle for incumbent leakage and the
  statistics for threshold inversion.
- Merge before creating candidate workspaces.
- Record the foundation merge SHA in this document's successor evidence, not by
  rewriting old candidate reports.

## What already exists

| Need                                       | Existing asset                                              | Foundation action                                                |
| ------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| pure selector semantics                    | `test/v1-model/selector-oracle.ts` and differential tests   | reuse and extend fixtures, never import production               |
| detailed incumbent evaluator cases         | `test/v1-selector-evaluator/evaluator.test.ts`              | mine observable cases; keep memo/reverse plumbing incumbent-only |
| Store/scope/transaction/subscription cases | `test/v1-committed-store-tree/**`                           | convert missing cross-kernel behaviors into neutral traces       |
| public/adapter/hydration checks            | `test/v1-public-candidate/**`                               | drive packed artifacts through the same operations               |
| shipped family compatibility               | frozen `test/v1-public-candidate/family*.test.ts` files     | run as a non-scoring A gate; do not rewrite expectations         |
| trace infrastructure                       | `test/oracle/**`                                            | reuse ordering and identity normalization patterns               |
| paired estimator and FDR                   | `scripts/lib/paired-decision.ts`                            | parameterize, do not fork                                        |
| fresh-process packed workload              | `test/performance/core-load/**`                             | reuse all three frozen scenarios                                 |
| deterministic architecture counts          | `src/lib/architecturePerformance.test.ts`                   | use as control assertions and common-counter precedent           |
| retained-memory gates                      | `test/performance/architecture.memory.ts`                   | add paired reporting without replacing ceilings                  |
| package/root size gates                    | `scripts/check-package-size.ts`                             | run against exact candidate artifacts                            |
| split build and singleton domain           | `packages/valdres/build.ts`, `v1-internal/public-domain.ts` | preserve; test only in foundation                                |

## Test coverage and failure map

```text
FOUNDATION CONTROL FLOW                              EVIDENCE

[manifest + report schema]
          |
          +--> [schema/hash preflight] ------------> provenance.json
          |          | reject
          |          +-----------------------------> failed gate ID
          |
[source commit] -> [production pack] -> [semantic preflight]
                                          |
                 +------------------------+----------------------+
                 | pass                                          | fail
                 v                                               v
        [fresh-process timing]                            no timing admitted
                 |
        [raw paired samples] -> [paired analysis] ------> timing-decisions.json
                 |
        [separate counter build] -----------------------> counters.json
                 |
        [memory + package size] ------------------------> memory/sizes
                 |
        [report validator] -> report.json -> report.md -> SHA256SUMS

SEMANTIC PATHS

selector read
  +-- current ------------------------------------------ [existing coverage]
  +-- recompute value/error/equal ---------------------- [existing coverage]
  +-- direct/indirect/cached cycle --------------------- [existing coverage]
  +-- causal blame + valid alternative path ------------ [foundation gap]
  +-- fresh/same-session prefix revalidation ----------- [foundation gap]
  +-- sticky caught fault + retained child/prefix ------- [foundation gap]

Store host
  +-- committed source finality ------------------------ [existing, neutralize]
  +-- scratch commit/abort ----------------------------- [existing, neutralize]
  +-- scope isolation/dispose/recreate ----------------- [existing, neutralize]
  +-- hydration disposable host ------------------------ [existing, neutralize]
  +-- notification order/fault quarantine -------------- [existing, neutralize]
  +-- async settle/supersede/cancel -------------------- [existing, neutralize]
```

| Failure mode                                         | Required detection                                 | User-visible result                                          |
| ---------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| candidate accepts a cached dynamic cycle             | exhaustive/dynamic semantic fixture, DAG validator | blocked before timing; no hanging Store ships                |
| candidate throws a valid cycle at the wrong selector | A causal-blame validator                           | blocked; diagnostics do not silently drift                   |
| caught cycle later returns a value                   | sticky-fault and later-get fixture                 | blocked; no corrupt current value                            |
| parent failure discards a valid child                | child-retention/retry trace                        | blocked; prevents repeated work and semantic drift           |
| scratch or hydration edges enter committed state     | post-host graph snapshot and retry trace           | blocked; no cross-generation stale result                    |
| callback error changes commit/notification order     | exact ordered trace                                | blocked; source remains final and callbacks stay predictable |
| JIT/thermal regime splits samples                    | paired flags plus recorded runner state            | inconclusive/fail, never averaged into a win                 |
| instrumented artifact is timed                       | artifact hash and instrumentation probe            | provenance failure                                           |
| fixture is edited on one candidate branch            | protected-path and manifest hashes                 | provenance failure                                           |
| candidate retains disposed graph state               | paired heap plus absolute release ceiling          | memory failure                                               |
| candidate code leaks through a root-only import      | packed reachability and gzip fixtures              | size/packaging failure                                       |
| ShiftX parser ignores signed `timeDeltas`            | frozen parser hash and trace-parser self-test      | external evidence rejected                                   |

No silent failure mode remains untested in the work order. The foundation is not
complete until the red mutations in F8 prove these checks can fail.

## Parallelization and merge order

The foundation is one sequential branch because its DSL, runner, statistics, and
report hashes form one trust boundary. Review, fixture auditing, and live A/A
runs may execute in parallel, but implementation does not fan out into
independent merge bases.

| Step                        | Modules                                            | Depends on          |
| --------------------------- | -------------------------------------------------- | ------------------- |
| F0 schemas/hashes           | tournament test directory                          | specification merge |
| F1 artifact driver          | tournament runner                                  | F0                  |
| F2 semantic runner          | tournament fixtures, v1 model tests                | F0, F1              |
| F3 workloads                | tournament workloads, existing performance harness | F0, F1              |
| F4 statistics               | scripts paired analysis                            | F0                  |
| F5 provenance/report        | tournament reporter                                | F1, F2, F3, F4      |
| F6 memory/size              | existing memory and package checks                 | F1, F5              |
| F7/F8 control and red proof | all foundation modules                             | F2-F6               |
| F9 review/merge             | repository checks                                  | F7, F8              |

After F9 merges, launch the three C-stage branches in parallel workspaces. No
family workspace is needed: it is already present in the common control and
candidate substrate. A qualification branch waits only for its own C report, not
for another candidate to finish. Boundary extraction waits for at least one
alternative to pass A and the synthetic screen. ShiftX waits for that survivor's
resource gates.

### Conductor workspace launch order

| When                                          | Workspace / branch                             | Base                                                                | Agent assignment                                                               |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| now                                           | `spec-selector-kernel-tournament`              | beta.36 `1c03f126`                                                  | land three declarative artifacts plus the required empty non-release CI marker |
| after the spec lands                          | `test-selector-kernel-foundation`              | exact spec merge SHA on `origin/main`                               | one implementation agent owns F0-F9 sequentially; run `/review` before merge   |
| after foundation F9 and green/red bundles     | `spike-selector-kernel-incumbent-lite`         | exact frozen foundation merge SHA                                   | one candidate agent, Contract C and declared intended lanes only               |
| same gate, in parallel                        | `spike-selector-kernel-reactive-currentness`   | same frozen foundation merge SHA                                    | one candidate agent, Contract C and declared intended lanes only               |
| same gate, in parallel                        | `spike-selector-kernel-dynamic-topological`    | same frozen foundation merge SHA                                    | one candidate agent, Contract C and declared intended lanes only               |
| per C survivor                                | matching `qualify-selector-kernel-<candidate>` | same frozen foundation SHA plus cherry-picked frozen candidate diff | one qualification agent completes Contract A and the synthetic/resource screen |
| after an A survivor needs external packaging  | `test-selector-kernel-packaging`               | frozen foundation merge SHA                                         | one mechanical packaging agent; no names, exports, or algorithm                |
| after A plus synthetic/resource qualification | reuse the qualification workspace for ShiftX   | exact qualified candidate revision                                  | evidence runner only; no code tuning during a run                              |
| after at least one full survivor              | `internal-selector-kernel-boundary`            | then-current `origin/main`                                          | derive the smallest internal boundary from working implementations             |
| after artifact-backed selection               | `integrate-selector-kernel-winner`             | then-current `origin/main`                                          | apply the winner and rerun every gate                                          |

Do not launch a family workspace, a candidate workspace before foundation F9, or
a shared-boundary workspace before an alternative passes A. Reviewer agents may
find defects, but they do not vote on advancement; only recorded artifacts and
gates do.

## NOT in scope

- Candidate algorithms: each belongs to its named spike branch.
- A common kernel interface: derive it from working survivors later.
- Public experimental entry names or stability promises: packaging proof is
  mechanical only until a survivor needs ShiftX.
- Generalized `valdres/inspect`: current inspection is incumbent-coupled and is
  not used as neutral timing evidence.
- Shipping or reverting beta.36: it remains the control and current release.
- New `family()` product work or tournament scoring: its shipped surface is a
  frozen compatibility gate only.
- Collection-to-selector integration: wait until the kernel boundary is known.
- New release numbers: Changesets and the generated version PR own them.

## Implementation tasks

- [ ] **T1 (P1, human: ~3h / Codex: ~45m)** - schemas - validate and freeze the
      manifest, report schema, control hashes, and protected paths.
    - Surfaced by: foundation trust boundary.
    - Files: `packages/valdres/test/selector-kernel-tournament/**`.
    - Verify: malformed, duplicated, and modified normative inputs fail closed.
- [ ] **T2 (P1, human: ~1d / Codex: ~3h)** - artifact driver - pack and execute
      clean production control/candidate artifacts without source imports.
    - Surfaced by: provenance and timed-artifact separation.
    - Files: tournament runner and package script entries.
    - Verify: Node/Bun installed-tarball probes plus instrumentation rejection.
- [ ] **T3 (P1, human: ~3d / Codex: ~1d)** - semantics - implement
      candidate-neutral C/A traces and exhaustive small-graph checking.
    - Surfaced by: missing Store-level cross-kernel oracle.
    - Files: tournament semantic fixtures and existing test-only model helpers.
    - Verify: beta.36 green plus each F8 semantic mutation red.
- [ ] **T4 (P1, human: ~2d / Codex: ~6h)** - workloads - port corrected rewire
      lanes and add the frozen fanout/shape/hydration cases.
    - Surfaced by: shape-dependent beta.36 tradeoffs and ordinary
      separate-commit gap.
    - Files: tournament workloads and wrappers around existing performance
      assets.
    - Verify: exact work counts/checksums and timer-boundary tests.
- [ ] **T5 (P1, human: ~2d / Codex: ~6h)** - statistics - parameterize and
      calibrate paired C/A policies without changing current PR defaults.
    - Surfaced by: promotion thresholds need affirmative non-regression
      evidence.
    - Files: `scripts/lib/paired-decision*`, tests, tournament analysis.
    - Verify: deterministic simulations, A/A, injected wins/regressions,
      bimodality.
- [ ] **T6 (P1, human: ~1d / Codex: ~4h)** - provenance/reporting - emit,
      validate, render, and hash the complete evidence bundle.
    - Surfaced by: artifact-only candidate decisions.
    - Files: tournament provenance/report modules.
    - Verify: every tamper/missing-field fixture fails with an exact gate ID.
- [ ] **T7 (P2, human: ~1d / Codex: ~3h)** - resources - integrate paired heap
      and exact-artifact size/reachability checks.
    - Surfaced by: promotion requires bounded heap and root/packed size.
    - Files: tournament wrappers around memory/package harnesses.
    - Verify: retained-node and root-leak mutations fail.
- [ ] **T8 (P1, human: ~1d / Codex: ~4h)** - control proof - publish beta.36
      green and F8 red evidence before fanout.
    - Surfaced by: a gate is not trustworthy until both pass and fail paths run.
    - Files: external evidence directory plus runner tests.
    - Verify: `SHA256SUMS`, clean provenance, all expected green/red verdicts.

## Engineering review completion

- Step 0 Scope Challenge: scope held to three declarative artifacts now and one
  candidate-neutral foundation PR next.
- Architecture Review: no unresolved issues; public packed driving and
  candidate-owned adapters avoid a premature kernel seam.
- Code Quality Review: no runtime code in this branch; DRY requirement is to
  extend existing oracle/statistics/memory/size assets.
- Test Review: coverage/failure diagram produced; eight foundation task groups
  close the identified gaps.
- Performance Review: exact lanes, pair counts, thresholds, tail, heap, size,
  and ShiftX rules specified.
- NOT in scope: written.
- What already exists: written.
- TODO updates: none; all work is ordered in this document.
- Failure modes: zero accepted silent gaps; F8 must prove every red path.
- Baseline amendment: beta.36 is the shared family-inclusive control; beta.35 is
  diagnostic-only and cannot affect eligibility.
- Outside voice: two saved analyses informed risks; their recommendations have
  no decision authority.
- Parallelization: one sequential foundation lane, then three parallel C lanes
  with no separate family workspace.
- Completeness: all requested tournament dimensions specified.

## GSTACK REVIEW REPORT

| Review        | Trigger               |                        Why | Runs | Status         | Findings                                         |
| ------------- | --------------------- | -------------------------: | ---: | -------------- | ------------------------------------------------ |
| CEO Review    | `/plan-ceo-review`    |           Scope & strategy |    0 | not run        | checkpoint decisions treated as settled          |
| Codex Review  | `/codex review`       | Independent second opinion |    0 | not run        | model consensus is non-authoritative             |
| Eng Review    | `/plan-eng-review`    |       Architecture & tests |    1 | clear          | 0 unresolved issues, 0 critical gaps in the plan |
| Design Review | `/plan-design-review` |                 UI/UX gaps |    0 | not applicable | no UI scope                                      |
| DX Review     | `/plan-devex-review`  |  Developer experience gaps |    0 | not run        | foundation commands remain to implement          |

**VERDICT:** ENG CLEARED - ready to implement the candidate-neutral foundation;
candidate work remains blocked on its merge.

NO UNRESOLVED DECISIONS
