# atomFamilySearch — engine v2 design notes

Status after round 2. **Shipped** (this branch): IDF/avgdl hoist, `suggest()`,
`highlight()`, pagination, `stats`, the tested **WAND top-K core**
(`lib/wandTopK.ts`), **#6 descriptor unification**
(`lib/createSearchDescriptor.ts`, wired into `atomFamilySearch`, ~20% faster
insertion, verified equivalent; legacy two-descriptor backend deleted), and —
now — **#9 WAND wiring + #10 on-demand columnar postings** (ranked+limit
queries use `wandTopK` over per-query sorted `Int32Array` postings built via
`ordinalOf`; ~2.8× faster top-K on a high-df query, byte-identical to naive
per the WAND-vs-naive parity fuzzer). **Specced here** (still deferred): #11
finer-grained invalidation; the optional persistent Set→Int32Array storage
swap (memory only). Plus foundation notes
for the later items (#7 bulk-load, #8 serialize, #12 filter/facet, #13
query-time weights).

With #6 done, the single `createSearchDescriptor` is the place #10 (columnar
postings / ordinal map) and #9 (WAND) now plug into — no second backend to
reconcile. The differential fuzzer (`atomFamilySearch.fuzz.test.ts` +
`createSearchDescriptor.test.ts`) is the gate for those next changes.

The recurring constraint behind every deferred item: search reactivity rides
on `atomFamilyIndex`'s term atoms + scope chain (`createAtomFamilyIndexDescriptor`),
the exact machinery flagged in `[[project_scope_family_txn_soundness]]`.
Anything that changes posting storage must preserve: subscribed + unsubscribed
re-read correctness, scope shadowing/inheritance, lazy term-atom
materialization, and cross-scope propagation.

---

## #9 — wire WAND into the query path

`lib/wandTopK.ts` is done and verified identical to brute force (300 random
corpora, exact tie-break). What remains is building per-query cursors and
gating eligibility so the WAND path is provably identical to the naive path.

**Per-term cursor** (one per expanded query term):

- `postings`: the term's matching doc **ordinals**, ascending → needs the
  ordinal map (below). Build from `getTokenSet(term)` mapped to ordinals,
  sorted; cache by bucket-array identity (like `tokenSetCache`).
- `maxImpact`: a safe upper bound on the term's per-doc contribution. The
  cheap, valid bound needs **no per-term storage**:

  ```
  maxImpact(t) = penalty(t) × maxFieldBoost × idf(t) × (k1 + 1 + d)
  ```

  because `bm25TfLen = (d + tf(k1+1)) / (tf + k1(1−b+b·dl/avgdl)) ≤ (k1+1) + d`
  for `tf ≥ 1` (denominator ≥ tf). Loose, but the discriminating factor is
  `idf(t)` — exactly the signal WAND should prioritize. `penalty ≤ 1` and
  `coordFactor ≤ 1` only tighten it, so the bound stays valid.

**Doc evaluation.** `wandTopK` currently sums per-term `score()`. Coordination
is a per-**doc** post-multiplier, so the integration needs a doc-level eval
instead: **refactor `wandTopK` to take `scoreDoc(ordinal) => number | null`**
(null = fails `minMatch`, skip) instead of per-term `score`, and update its
tests. `scoreDoc` does exactly what the naive inner loop does for one doc — sum
`penalty × boost × bm25ScoreWithIdf` across present terms (looked up by mapping
the ordinal back to its atom → `getFieldStats`), then `× coordFactor(coverage)`.
The `Σ maxImpact` pivot gate stays valid because `coordFactor ≤ 1` and
`penalty ≤ 1`. Postings: build per-query sorted `Int32Array` from each
expanded term's bucket via `sd.ordinalOf` (+ a local `Map<ordinal, atom>` for
that query's `scoreDoc` / result mapping — leak-free, GC'd with the query).

**Eligibility** (else fall back to the naive path — unchanged):

- `limit` is finite (WAND only helps top-K), and
- root store (`bm25Storage.parent === undefined`) — defer scope-chain posting
  merges, and
- no quoted phrases (the adjacency filter is post-scoring), and
- `match: "ranked"` (AND/`match:"all"` already prune via intersection).

**matched-token metadata** for `scored()`: recompute for the K winners only
(cheap) — WAND returns ordinals+scores; map back and re-derive `matched`.

**Interaction with pagination (important).** Round 2 made `getFullScored`
cache the *full* sorted ranking so pages are cheap slices. WAND only produces
the top-K — it can't serve `offset > 0`. So WAND is a separate fast path for
the **unpaginated top-K view** (`offset 0`, `limit` = the K you want); a
paginated call must still fall back to the full naive ranking. Cleanest shape:
keep `getFullScored` (naive, full, cached, drives pagination) and add a
parallel `getTopK(query)` that uses WAND for the default view only. Don't try
to make one cache serve both.

**Safety gate before shipping:** a test that runs a large query battery
through BOTH paths (force-naive vs WAND-eligible) and asserts identical
`scored()` output (ids, scores, order, matched). Only ship once that's green
across modes/options. This is the parity burden that makes it review-worthy.

---

## #10 — columnar postings  &  #6 — unify the two descriptors

Today search runs **two** descriptors over each write: `tokenIndex`
(`atomFamilyIndex` → `Set<atom>` buckets + reactivity) and the BM25 descriptor
(`perAtom` field stats). They each store a per-atom term association — the
redundancy #6 targets.

**Measured (flagged spike, 5k docs, exact, root).** A faithful one-pass
unified descriptor (buckets + per-field stats + fieldTotals, single per-atom
record, no separate `atomTerms`) ran the same corpus through the real store:

```
current (two descriptors): 21.2ms
unified (one pass):        14.0ms     → 34% faster total insertion
```

Notably the unified figure (~14ms, buckets AND stats) ≈ the current
`tokenIndex`-alone pass (~12.7ms) — i.e. the BM25 stats are nearly free once
fused into the bucket pass, so the second descriptor's ~8.7ms marginal cost is
mostly two-pass overhead (dispatch, the WeakMap memo round-trip, the duplicate
`atomTerms` record, `new Set(termKeys)` + flatten), not the stats. Search-
specific overhead drops ~52% (≈13.9ms → ≈6.7ms over a plain family write).
Round 1's shared-term-frequency change already took the easy part, but the
two-pass overhead remaining is worth ~⅓ of insertion. Conclusion: #6 is
worth doing — gated on the differential fuzzer below.

**Refinement (learned while building #6):** columnar postings do NOT require
swapping the reactive `Set` storage. Keep the Set buckets exactly as-is (zero
reactivity risk) and build the sorted `Int32Array` columnar form **on demand**
for the WAND path, addressed by `ordinalOf`. This sidesteps the
ordinal-lifecycle / leak trap of a *persistent* `atom→ordinal` + reverse map
(a child-only atom deleted in its scope would leak its ordinal). So #10 (the
query-side win) and #9 (WAND) collapse into one consumer; the persistent
Set→Int32Array *storage* swap (a memory win only) becomes an optional,
separate optimization.

**Shipped:** `ordinalOf` (assign-on-demand `WeakMap<atom, int>`, leak-free) on
`createSearchDescriptor` + test. WAND builds sorted `Int32Array` postings by
mapping a bucket's atoms through it. (`#8 serialize` will want a separate
*enumerable* persistent map — `WeakMap` can't be iterated.)

**Columnar postings:** `Map<term, Int32Array>` (sorted ordinals) replaces
`Set<atom>`. Wins: ~constant-factor smaller memory, sorted-merge intersection
for `match:"all"`, and the sorted postings WAND needs. Cost: the reactivity.

**The hard part (why #6 is deferred).** The term atoms from
`createAtomFamilyIndexDescriptor` are what queries subscribe to. To drop the
`Set` buckets and serve reactivity from columnar postings, either:

- **(a) Unified search descriptor** that owns columnar postings AND re-implements
  scope-aware term atoms + lazy materialization + cross-scope propagation. Most
  memory/indexing upside; re-implements the subtle machinery → highest risk.
- **(b) Generalize `createAtomFamilyIndexDescriptor`** to a columnar storage mode
  (keep its proven reactivity, swap `Set` for `Int32Array` + ordinal map).
  Lower risk, contained to one file, but couples a search concern into the
  generic primitive. **Recommended starting point.**

Either way, keep an `atom↔ordinal` map and verify the full search suite +
the scope tests + unsubscribed-reread guards stay green.

A cheaper interim that captures most of #10's query benefit without the
reactivity rewrite: maintain columnar postings **additively** (alongside the
Set buckets) only when an opt-in `topK`/`fastRank` flag is set, use them for
WAND, and accept the extra memory for opted-in instances. No default-path risk.

---

## #11 — finer-grained query invalidation

Today every write bumps `bm25Atom`'s epoch, so every active query recomputes
on every write. Finer-grained = skip recompute when a query's matched buckets
didn't change.

**Why it's risky / deferred.** `bm25Atom` is global *because* stats (N, avgdl)
shift on every write, so a query's **scores** legitimately change on unrelated
writes. Skipping recompute trades exactness for speed — precisely the staleness
class that produced the round-1 false-alarm. A safe version would need: (a)
separate "result set changed" from "scores drifted" signals, (b) only skip when
neither a matched term's bucket nor the corpus stats moved materially, (c)
explicit opt-in (`approximateScores: true`) so the staleness is a documented
choice. Not worth shipping silently.

---

## Foundation for the rest (later)

- **#13 query-time field weights** — `search(q, { fields: { title: 3 } })`.
  Smallest lift: thread a per-call weight map into `computeScored` (override
  `fieldBoost`), fold the weights into the page/cache key. No storage change.
  Good "next cheap win."
- **#8 serialize / hydrate** — needs the ordinal map + a stable term order;
  serialize `{ ordinals, postings, fieldStats, fieldTotals }`, rebuild the
  derived structures (trie/BK-tree) on hydrate. Biggest real-world win for web
  apps (skips re-indexing on reload). Build after the ordinal map exists.
- **#12 filter + facet** — equality filters compose with `atomFamilyIndex`
  (intersect a filter bucket with the candidate set); facet counts are bucket
  sizes. The ordinal map makes the intersections `Int32Array` merges. This is
  the change that turns the ranker into a search backend.
- **#7 bulk-load** — `search.bulkLoad(entries)`: one build pass (sort postings,
  compute stats) instead of N incremental writes. Needs columnar postings to
  pay off; pairs with #8.
