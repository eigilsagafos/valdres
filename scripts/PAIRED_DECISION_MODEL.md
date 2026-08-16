# Paired benchmark decision model

Status: **blocking for protected comparisons**. The unprivileged
`.github/workflows/bencher-pr.yml` measurement workflow runs the balanced ladder
for same-repository and fork pull requests. The trusted
`.github/workflows/bencher-pr-gate.yml` workflow replays this model from the
default branch and fails on a protected `regression`. `inconclusive` rows rerun
to the twelve-pair cap and remain non-blocking there. The original three-pair
`min(head/base)` +50% Bencher threshold remains as a redundant catastrophic
backstop.

## Why replace `min(head/base)`

The shipped gate takes the smallest of a benchmark's paired head/base ratios.
That is a deliberate one-sided filter — runner interference only ever makes a
sample slower, so the smallest ratio is the least contaminated one — and it
fixed a real flake problem (#268). What it cannot do is express confidence.

Its failure case is on record: one CI job measured `set(atom, value)` at base
131/131/131 ns against head 351/351/131 ns. Two of three pairs were 2.7x slow.
`min` reports **0% change**, because one clean pair is enough to clear it. The
statistic has no way to say "these three pairs disagree with each other".

The consequences compound:

- A benchmark that is never alerted on is indistinguishable from one that was
  demonstrated healthy. Absence of an alert is not evidence.
- Sensitivity is bounded by the noisiest pair, so the boundary has to sit at
  +50% — far above the regressions worth catching.
- Adding benchmarks or runtimes silently raises the chance that some row clears
  by luck, and nothing accounts for it.

## The model

### Measurement protocol

Measurements come in balanced **B-P-P-B blocks**. Each block yields two pairs:
`(base@1, head@2)` and `(head@1, base@2)`. Head is measured before base exactly
as often as after, so a monotonic drift across the block — thermal, a noisy
neighbour ramping up, page cache warming — enters the two pairs with opposite
sign and cancels in the paired log-ratio. Under the old fixed base-then-head
order, that drift was indistinguishable from a regression.

One **round** is two blocks, i.e. four pairs per lane, where a lane is one
(runtime, suite) combination.

### Statistic

For each benchmark, per pair: `r_i = ln(head_i) - ln(base_i)`.

Logs make the statistic symmetric (a 2x regression and a 2x speedup are ±ln 2)
and turn the multiplicative runner-wide slowdown that motivated relative CB into
an additive term that pairing removes.

- **Location**: Hodges-Lehmann, the median of the Walsh averages. Chosen by
  measurement, not assumption — `robust-estimators.test.ts` compares it against
  the mean, the median and a 20% trimmed mean on the two properties that matter.
  One stalled pair in four moves the mean by >20% and HL by <3%; on clean data
  HL scatters less than the median and within 15% of the mean. A 20% trimmed
  mean trims _nothing_ at four values, so it is the mean exactly where
  robustness is needed most. HL is the only candidate that wins on both counts.
- **Dispersion**: the Winsorized (Yuen) standard error, which collapses to
  `s/sqrt(n)` when the trim count rounds to zero, floored at 0.5% of a
  log-ratio. The floor matters: four pairs agreeing to the nanosecond do not
  mean the measurement is exact, only that the timer, the JIT tier and the batch
  size all held still. Without it, identical samples manufacture unbounded
  confidence.
- **Interval**: an exact Student-t tail on the incomplete beta. No bootstrap, no
  RNG, no clock — a verdict is reproducible from the uploaded NDJSON alone.

### Three outcomes

Every comparison is tested against one relative budget (+10%) in both
directions:

| outcome         | meaning                                           |
| :-------------- | :------------------------------------------------ |
| `regression`    | the effect is above budget, at the adjusted level |
| `within-budget` | the effect is demonstrably below budget           |
| `inconclusive`  | the data cannot separate the two                  |

"No alert" and "demonstrated healthy" stop being the same answer. `inconclusive`
is a first-class result, not a failure — it is what drives the rerun ladder.

A comparison whose log-ratios split into two clusters separated by one dominant
gap is flagged **bimodal** and never receives a verdict, because no single
number summarises two process states. The historical 131/351 vector lands here:
reported as `+109%, bimodal, inconclusive` instead of `0%`.

The bimodality test is a minority _share_, never an absolute count. Two deviant
pairs out of three are two process states; the same two out of twelve are two
stalls the robust estimator already absorbs. An absolute threshold would latch,
and a lane contaminated in round 1 could never be cleared by rerunning.

### Protected set and the timing floor

`lib/bench-protected-set.ts` holds eleven decision-bearing benchmarks, one
aggregated workload per subsystem. "Decision-bearing" means the row receives a
statistical verdict, can request another PR-measurement round, and blocks on a
`regression`. Everything else is informational.

The known-noisy `atomFamily: txn update 5,000 existing members` row remains in
raw observations and the coarse +50% backstop, but is quarantined from the
protected family. `atomFamily: direct create + delete 500 members` replaces it
as the decision-bearing family-membership workload. The selector-family slot is
likewise the high-cardinality retained-entry lookup rather than the smaller
propagation case.

Independently, any comparison whose base measurement is below **1000 ns** is
demoted to informational whatever the set says. A +10% budget on a 131 ns
operation lands inside the JIT-tier and timer noise; that is not a threshold
anyone can defend. Each demoted operation maps to the aggregated equivalent that
exercises the same hot path thousands of times per sample — `store.get(atom)` to
`get 1000 atoms`, `sub + unsub` to
`subscribe + unsubscribe 100 shared selector pairs`, and so on. The map is
enforced by a test that fails if an aggregate is renamed out from under it, so
demotion cannot quietly become a blind spot.

The same floor applies to the **blocking** converter, not just this report.
`BENCH_EXCLUDE_TINY` previously consulted only a hand-curated name list, which
had drifted: `set(atom, value)` (~110 ns), `set(atom, curr => curr+1)`,
`set(atom) with 10 subs`, `sub + unsub` and `createStore` were all
sub-microsecond and all still blocking — and the first two are exactly the rows
that flaked the gate on unrelated PRs. The floor closes that gap and stays
closed as benchmarks are added. In the paired path the floor is evaluated once,
from the **base** side, so a small operation whose head crosses 1000 ns cannot
produce a base/head name-set mismatch and fail the conversion closed on a real
finding. A test asserts every mapped raw operation is absent from the blocking
BMF.

Deterministic operation **counters** would guard these hot paths with no timing
noise at all. That needs instrumentation in valdres core rather than CI tooling,
so it is deliberately left to a follow-up.

### Multiple comparisons

p-values are Benjamini-Hochberg adjusted for false discovery rate at 0.05,
separately within the protected and informational families, and separately per
direction. The family spans benchmarks _and_ runtimes: 11 benchmarks x 2
runtimes = 22 protected comparisons.

Keeping the protected set small is what makes this affordable. FDR control
across 22 comparisons leaves usable power at four to twelve pairs; control
across all ~120 comparisons in the suite would not.

### The rerun ladder

After each round, any lane holding an inconclusive **protected** comparison gets
another round of pairs, to a hard cap of 3 rounds (12 pairs). The cap is
absolute: an unresolved lane is reported as "still inconclusive at the round
cap", never retried forever.

The Yuen degrees of freedom go 3 → 5 → 7 across the rungs, which is why a round
is four pairs and not two — at n=6 the degrees of freedom are still 3 and the
extra pairs buy almost nothing.

Only lanes with protected benchmarks can trigger a rerun. The async suite holds
none, so it always runs exactly one round — four pairs, while a noisy protected
standard lane can reach twelve. That asymmetry is deliberate: reruns exist to
resolve blocking verdicts, and async rows do not block. The async lanes instead
buy their repeatability inside the process, with the tier-settle protocol below.

### Async settlement lanes and the JSC tier ramp

The five async settlement benchmarks measure one settlement per operation, so
their measurement windows contain only ~50k operation executions — three orders
of magnitude fewer than the aggregated standard workloads. That exposed a
mechanism the standard suite never sees:

- Mitata generates a **fresh measurement-loop function per `measure()` call**,
  so the recorded window starts in the engine's interpreter and contains the
  whole JIT tier ramp (LLInt → Baseline → DFG → FTL on JSC). Tier thresholds are
  execution counts, and on JSC the ramp spans tens of thousands of executions —
  a large, environment-sensitive fraction of a ~50k-execution window.
- Mitata's own `warmup_samples` cannot help: its warmup loop exits as soon as
  one call lands under the 65µs batch threshold, which is the first call for
  these microsecond operations. The suite's explicit `warmupRuns` train `fn` but
  not the generated loop; 200k explicit warmups were measured and the ramp
  persisted.
- The 12-sample p50 of a window whose first half sits ~2x above its second half
  flips between tiers from process to process. Hosted same-code A/A estimates
  swung from -5.9% to +22.1% on Bun/x64, with every process showing the fast
  tier at p25 and the slow tier at p75. The Node/V8 lane stays stable because V8
  re-tiers a fresh loop within one or two batches.

The **tier-settle protocol** (`tierSettle` in `measureOne`) discards whole
measurement windows until two consecutive window p50s agree within 5%, capped at
five windows, and reports the final window. JSC's code cache reuses tiered code
across identical generated loops, so the second window typically starts warm.
Mid-ramp windows disagree by 15–45% and settled windows by ~2–4% on both
engines, so the 5% tolerance separates regimes instead of tuning one. Nothing is
averaged away: every discarded window's p50 is recorded in the observation
(`tierDiscardedP50s`), and a process that hits the cap without settling is
written with `tierSettled: false` and reported as a `tier-unsettled` flag — like
`batch-size-shift`, reported and never decisive.

Measured effect (local A/A, ten fresh processes per arm, worst case): the
selector-resolve-unobserved p50 dispersion fell from 11.7% sd of ln (max/min
1.48x) to 2.2% (1.07x), and a deterministic busy-loop slowdown injected into
`setValueInData` was still detected on all five async rows with tight intervals,
the smallest at +12.6% [+10.4%, +14.8%]. Rejected alternatives: larger explicit
warmup (ramp lives in the generated loop, not `fn`), longer windows via
`min_cpu_time`/`min_samples` (linear CI cost and the median stays ramp-biased
until the window dwarfs the ramp), and per-case process isolation (the suite's
fixed case order shifts steady-state levels deterministically and identically
for both sides, so isolation buys nothing the pairing does not already
guarantee).

The weekly/manual deep workflow remains advisory: it has no pull-request
trigger, Bencher secret, Bencher upload, threshold, or regression gate. In the
PR path, workflow separation instead enforces the trust boundary. Untrusted PR
code produces raw artifacts without secrets; the `workflow_run` gate executes
only default-branch analysis code, validates artifact identity and bounds, and
publishes the required check on the PR head SHA.

The analyzer runs once per completed round and writes files only. Each round's
JSON decision is retained, while the workflow publishes the final Markdown
report exactly once.

### What the catastrophic gate sees

The shipped `min(head/base)` +50% gate is preserved exactly, and "exactly" is
load-bearing. The PR measurement copies only the first three round-one pairs in
B-P, P-B, B-P order into its backstop artifact. The fourth balanced pair and
every ladder round feed only the statistical model, so they cannot dilute the
old statistic.

Handing it a fourth pair would strictly weaken it, because `min` is monotone
decreasing in the number of pairs: `min([1.7, 1.7, 1.7])` is 1.7× and blocks,
while `min([1.7, 1.7, 1.7, 1.0])` is 1.0× and passes on the very same three
measurements. An earlier revision of this work did exactly that and described it
as "marginally more permissive". It was not marginal, and preserving a backstop
means preserving it.

## Operating characteristics

Generated from the model, one true effect embedded in a family of 22. The
assertions in `lib/paired-decision.test.ts` lock the load-bearing rows.

**Pair-to-pair jitter ±1%**

| true effect | 4 pairs (round 1) | 8 pairs (round 2) | 12 pairs (round 3) |
| :---------- | :---------------- | :---------------- | :----------------- |
| -30%        | within budget     | within budget     | within budget      |
| +0%         | within budget     | within budget     | within budget      |
| +5%         | within budget     | within budget     | within budget      |
| +10%        | inconclusive      | inconclusive      | inconclusive       |
| +15%        | regression        | regression        | regression         |
| +20%        | regression        | regression        | regression         |
| +50%        | regression        | regression        | regression         |

**Pair-to-pair jitter ±3%**

| true effect | 4 pairs (round 1) | 8 pairs (round 2) | 12 pairs (round 3) |
| :---------- | :---------------- | :---------------- | :----------------- |
| -30%        | within budget     | within budget     | within budget      |
| +0%         | within budget     | within budget     | within budget      |
| +5%         | inconclusive      | within budget     | within budget      |
| +10%        | inconclusive      | inconclusive      | inconclusive       |
| +15%        | inconclusive      | inconclusive      | regression         |
| +20%        | inconclusive      | regression        | regression         |
| +50%        | regression        | regression        | regression         |

**Pair-to-pair jitter ±6%**

| true effect | 4 pairs (round 1) | 8 pairs (round 2) | 12 pairs (round 3) |
| :---------- | :---------------- | :---------------- | :----------------- |
| -30%        | within budget     | within budget     | within budget      |
| +0%         | inconclusive      | within budget     | within budget      |
| +5%         | inconclusive      | inconclusive      | inconclusive       |
| +10%        | inconclusive      | inconclusive      | inconclusive       |
| +15%        | inconclusive      | inconclusive      | inconclusive       |
| +20%        | inconclusive      | inconclusive      | regression         |
| +50%        | regression        | regression        | regression         |

### False positives

Measured where it is actually hard: with the true effect sitting exactly **on**
the +10% budget, so every `regression` verdict is a false one. The ladder is
simulated faithfully — twelve pairs drawn once per row, round `r` analysing the
first `4r` of them — so the nested looks are included in the rate. 400 trials of
a 22-row family.

| jitter | false regressions (per comparison) | jobs with ≥1 false block |
| :----- | ---------------------------------: | -----------------------: |
| ±1%    |                             0.00 % |                    0.0 % |
| ±3%    |                             0.08 % |                    1.5 % |
| ±6%    |                             0.28 % |                    5.3 % |
| ±12%   |                             0.32 % |                    5.8 % |

`paired-decision.test.ts` asserts these bounds, so the table cannot drift away
from the code.

Note what this is **not**: an earlier version of this table measured at effect
`0`, ten points away from the boundary, and reported 0% everywhere. That is an
easy null and it proves nothing. The numbers above are the honest ones.

Per-comparison type-I error runs 15–60× **below** the nominal 5% FDR. The FDR
level is therefore an upper design target, not an exact guarantee — see "Known
approximations" below.

### False negatives

Read the tables downward, not across. The honest summary:

- **+50% is always caught**, at the minimum pair count, at every jitter level.
  This is the range the current +50% gate claims, and the model matches it
  without the 131/351 blind spot.
- **+20% needs a quiet runner or one ladder round.**
- **+15% needs the full ladder at ±3% jitter and is not reachable at ±6%.**
- **+10% is never called**, because it _is_ the budget. Refusing to separate an
  effect from the boundary it sits on is correct, not a miss.
- **A +5% regression is invisible.** The model does not claim otherwise.

The binding constraint below ~15% is the 0.5% standard-error floor combined with
four to twelve pairs. Buying more sensitivity means more pairs (linear CI cost)
or quieter measurement, not a different estimator.

### Known approximations

Stated plainly, because the model's output looks more exact than it is.

**The test statistic is not exactly t-distributed.** It pairs a Hodges-Lehmann
location with a Winsorized (Yuen) standard error shaped for a trimmed mean, plus
an efficiency correction, and reads the tail off a Student-t. That combination
is an approximation at 4–12 pairs, not an identity. So the 0.05 FDR is a design
target, and the measured type-I error above — 0.00–0.32% at the boundary — is
the number that should be trusted. It is conservative, by 15–60×.

**Why not exact permutation inference instead.** A paired sign-flip test on `n`
pairs cannot produce a one-sided p-value below `2^-n`, and BH across the 22-row
protected family needs the smallest p to clear `0.05 / 22 = 2.3e-3`:

| pairs | smallest attainable p | can it ever call a regression? |
| ----: | --------------------: | :----------------------------- |
|     4 |                6.3e-2 | no                             |
|     6 |                1.6e-2 | no                             |
|     8 |                3.9e-3 | no                             |
|    12 |                2.4e-4 | yes                            |

Exact inference would make rounds 1 and 2 structurally incapable of reporting a
regression of _any_ size — a 10× slowdown at four pairs would be `inconclusive`.
That trade buys exactness in a regime where the approximation is already
conservative, and pays for it with the model's entire early-detection ability.
`paired-decision.test.ts` locks this arithmetic, so if the protected family ever
shrinks enough to change the answer, the choice gets revisited.

**Sequential looks.** The ladder analyses after each round and stops when
nothing is inconclusive, which is optional stopping and inflates type-I error in
principle. Measured, the inflation is nil — a false call is driven by the drawn
pairs and persists across looks:

| jitter | fixed n=4 | fixed n=12 | ladder (3 looks) |
| :----- | --------: | ---------: | ---------------: |
| ±3%    |    0.01 % |     0.08 % |           0.08 % |
| ±6%    |    0.17 % |     0.28 % |           0.28 % |
| ±12%   |    0.19 % |     0.32 % |           0.32 % |

The ladder is indistinguishable from a fixed terminal sample size. Two
alternatives were measured and rejected:

- **Alpha-spending (`α/3` across looks)** cuts the boundary error to 0.00–0.07%
  but costs 15–30 points of detection at +15% and +20%, and drops +15% detection
  at ±1% jitter from 84% to 1%. Not worth it against an error rate already far
  below nominal — but it is the lever to pull first if calibration shows real
  jitter at or above ±6%.
- **Confirm-on-regression** (continue the ladder while any row reads
  `regression`, so blocking calls only happen at terminal `n`) measured
  _identical_ type-I error, while costing power and forcing all three rounds
  every time. No benefit.

These are decisions made against measurements, and the measurements are cheap to
rerun. If real-world jitter turns out worse than ±6%, revisit them in that
order.

### Runtime cost

Counted in suite invocations, which is the only part that is not
runner-dependent:

|                                      | invocations |
| :----------------------------------- | ----------: |
| PR/deep round 1 (2 blocks x 4 lanes) |          32 |
| each later standard-only round       |          16 |
| PR/deep worst case (cap reached)     |          64 |

The common case is 32 invocations. A noisy protected standard lane can take the
required PR path to 64; the cap is absolute.

## Calibration record

Collect approximately ten weekly A/A or manual deep runs before proposing any
new statistical policy. Each run retains its observations, per-round JSON
decisions, resolved SHAs, and final report for 90 days.

For each merge, collect:

1. **Outcome mix on the protected set.** How many rows land `within-budget` on a
   PR that changed nothing relevant? If that is not the large majority, the
   budget or the pair count is wrong.
2. **Ladder engagement.** How often does round 2 or 3 fire, and for which lanes?
   Persistent engagement on one benchmark means that benchmark is too noisy to
   protect and belongs in the informational set.
3. **Rows that reach the cap still inconclusive.** These are the model's real
   cost. A benchmark that never resolves is not gateable at any threshold.
4. **Disagreements with the catastrophic gate.** For a manual deep comparison
   that matches a relevant PR's resolved revisions, compare its verdicts with
   the required gate and record both disagreement directions.
5. **Observed pair-to-pair jitter** per protected benchmark, from `logRatios` in
   the JSON. This is what selects the correct row in the tables above, and it is
   currently the least-known input to the whole design.

The blocking promotion keeps the calibrated +10% budget and eleven-row protected
family size unchanged. It quarantines the noisy atom-family transaction row,
replacing it with direct create/delete churn.

The promotion's final hosted red/green check ran the report-only model before
enforcement was enabled:

- [A/A run 31850617341](https://github.com/eigilsagafos/valdres/actions/runs/31850617341)
  compared `ead824c9` with the identical-tree empty commit `c16feb84`. At the
  twelve-pair cap it reported 18 protected rows within budget, the two known
  noisy atom-family rows inconclusive, and zero regressions.
- [Synthetic-regression run 31850623664](https://github.com/eigilsagafos/valdres/actions/runs/31850623664)
  compared `c16feb84` with scratch commit `1a4d61c2`, which added a
  deterministic busy-loop to `getDefault`. It reported eight protected
  regressions across Bun and Node. Four selector decisions landed between +11.5%
  and +20.4%, proving the paired model blocks regressions that the +50% backstop
  cannot detect.

Future policy changes should continue to collect the five signals above. Do not
change the budget and protected family in the same calibration step.

## Notes for future work

**Mitata batch size.** The model does not tune it. If adaptive batch sizing is
ever added, the batch size must be a _positive multiple of Mitata's unroll
factor_ — a value that rounds to zero timed calls per batch yields a meaningless
sample rather than an error. Until then, each pair reports the batch size Mitata
chose on both sides, and a materially different choice between base and head is
surfaced as a `batch-size-shift` flag. That flag is reported and never decisive:
Mitata derives batch size from measured duration, so a genuine regression can
legitimately move it, and suppressing a finding on that basis would hide exactly
what is being looked for.

**Counters.** See the protected-set section — deterministic operation counts
would guard the nanosecond hot paths with no timing noise at all.
