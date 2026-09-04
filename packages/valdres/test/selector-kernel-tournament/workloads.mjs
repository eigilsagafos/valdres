import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"
import { runCoreLoadWorkload } from "../performance/core-load/workload.mjs"
import { readFixture } from "../performance/core-load/lib.mjs"
import { createBenchmarkAdapter } from "../performance/core-load/adapters/v1.mjs"
const hash = value =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex")
const structural = (a, b) =>
    a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
// Counts describe calls actually made in the timer, including callback reads.
// The transparent facade is harness code, identical for every packed artifact.
function meter(api) {
    let active = false,
        counts = {},
        consumed = 0
    const roots = [],
        atoms = [],
        selectors = []
    const count = key => {
        if (active) counts[key] = (counts[key] ?? 0) + 1
    }
    const wrap = target => ({
        get(state) {
            count("get")
            return target.get(state)
        },
        set(state, value) {
            count("set")
            return target.set(state, value)
        },
        update(state, fn) {
            count("update")
            return target.update(state, fn)
        },
        sub(state, fn) {
            count("sub")
            const off = target.sub(state, () => {
                count("callback")
                return fn()
            })
            return () => {
                count("unsub")
                return off()
            }
        },
        txn(fn) {
            count("txn")
            return target.txn(t => fn(wrap(t)))
        },
        scope(id, fn) {
            count("scope")
            if (fn) return target.scope(id, t => fn(wrap(t)))
            return wrap(target.scope(id))
        },
        dispose() {
            count("dispose")
            return target.dispose()
        },
    })
    return {
        api: {
            atom: (...args) => {
                const a = api.atom(...args)
                atoms.push(a)
                return a
            },
            selector: (...args) => {
                const s = api.selector(...args)
                selectors.push(s)
                return s
            },
            store: () => {
                const s = wrap(api.store())
                roots.push(s)
                return s
            },
        },
        begin() {
            active = true
            counts = {}
            consumed = 0
        },
        end() {
            active = false
            return { counts, consumed }
        },
        consume(value) {
            assert.equal(typeof value, "number")
            consumed += value
        },
        roots,
        atoms,
        selectors,
    }
}
export async function runWorkload({
    api,
    adapter,
    observer,
    entryPath,
    fixtureRoot,
    row,
    mode,
    makeLegacy,
}) {
    assert.ok(["timed", "counter"].includes(mode), "WORKLOAD-MODE")
    assert.equal(
        Boolean(observer),
        mode === "counter",
        "ARTIFACT-INSTRUMENTATION",
    )
    if (row.group === "packed-core-load") {
        const benchmark = await createBenchmarkAdapter({ entryPath })
        if (observer) {
            Object.defineProperty(benchmark, "instrumented", {
                get: () => true,
            })
            benchmark.resetWorkCounters = () =>
                observer.resetCounters({ trace: false })
            benchmark.snapshotWorkCounters = () => ({
                kind: "tournament-common",
                counters: observer.snapshot().common,
            })
        }
        const scenario =
            row.id === "P-CORE-INITIAL-VIEW"
                ? "initial-view-core"
                : row.id === "P-CORE-WRITES"
                  ? "writes"
                  : "no-writes"
        const result = await runCoreLoadWorkload({
            adapter: benchmark,
            fixture: readFixture(fixtureRoot + "/fixture.v1.json"),
            scenarioName: scenario,
            mode: mode === "timed" ? "timed" : "counters",
        })
        const counts = result.work
        const common = observer
            ? (result.internalWork.atTimerEnd?.counters ??
              result.internalWork.atTimerEnd ??
              null)
            : null
        if (observer && scenario === "initial-view-core") {
            const counters = observer.snapshot().common
            assert.equal(counters.selectorBodyEntries, 1358)
            assert.equal(counters.suppliedGets, 4281)
        }
        return {
            id: row.id,
            mode,
            durationNs: mode === "timed" ? result.elapsedMs * 1e6 : null,
            counts,
            checksum: result.semanticChecksum,
            common,
            core: result,
        }
    }
    const m = meter(api)
    const { atom, selector, store } = m.api
    const target = store()
    const p = row.parameters ?? {}
    let execute,
        verify,
        batch = 1
    let notifications = 0
    const subscribe = q =>
        target.sub(q, () => {
            notifications++
        })
    if (row.group === "negative-control") {
        const atoms = Array.from({ length: p.atoms }, () => atom(0))
        execute = () => {
            for (let i = 0; i < p.commits; i++)
                target.txn(t => {
                    for (let j = 0; j < p.writesPerCommit; j++)
                        t.set(
                            atoms[(i * p.writesPerCommit + j) % atoms.length],
                            i + 1,
                        )
                })
        }
        verify = () => {
            const expected = Array(p.atoms).fill(0)
            for (let i = 0; i < p.commits; i++)
                for (let j = 0; j < p.writesPerCommit; j++)
                    expected[(i * p.writesPerCommit + j) % atoms.length] = i + 1
            const values = atoms.map(a => target.get(a))
            assert.deepEqual(values, expected)
            return values
        }
    } else if (row.group === "stable-fanout") {
        const source = atom(0),
            selectors = Array.from({ length: p.selectors }, (_, i) =>
                selector(g => g(source) + i),
            )
        selectors.forEach(subscribe)
        execute = () => {
            for (let i = 1; i <= p.sourceCommits; i++) target.set(source, i)
        }
        verify = () => {
            assert.equal(notifications, p.selectors * p.sourceCommits)
            const values = selectors.map(q => target.get(q))
            assert.deepEqual(
                values,
                Array.from(
                    { length: p.selectors },
                    (_, i) => p.sourceCommits + i,
                ),
            )
            return values
        }
    } else if (row.group.startsWith("rewire")) {
        // Parameterized cumulative-sequence repro: each item reads the preceding
        // item's endpoint. Sequence membership uses structural equality, and every
        // move crosses to the next sequence. Expectations recompute plain arrays.
        const initial = Array.from({ length: p.items }, (_, id) => ({
            id,
            seq: id % p.sequences,
            duration: (id % 7) + 1,
        }))
        const items = initial.map(value => atom(value))
        const sequences = Array.from({ length: p.sequences }, (_, seq) =>
            selector(
                g =>
                    items.flatMap((state, id) =>
                        g(state).seq === seq ? [id] : [],
                    ),
                { equal: structural },
            ),
        )
        const ends = items.map((state, id) =>
            selector(g => {
                const item = g(state),
                    order = g(sequences[item.seq]),
                    index = order.indexOf(id)
                assert.ok(index >= 0)
                return (
                    item.duration + (index > 0 ? g(ends[order[index - 1]]) : 0)
                )
            }),
        )
        for (const q of ends)
            for (let i = 0; i < p.subscribersPerItem; i++) subscribe(q)
        const expected = initial.map(x => ({ ...x }))
        for (let i = 0; i < (p.moves ?? p.changes); i++) {
            const item = expected[i % expected.length]
            item.seq = (item.seq + 1) % p.sequences
        }
        const move = (t, index) => {
            const id = index % items.length
            const current = t.get(items[id])
            const next = { ...current, seq: (current.seq + 1) % p.sequences }
            assert.notEqual(current.seq, next.seq)
            t.set(items[id], next)
        }
        execute = p.moves
            ? () => {
                  for (let i = 0; i < p.moves; i++) move(target, i)
              }
            : () =>
                  target.txn(t => {
                      for (let i = 0; i < p.changes; i++) move(t, i)
                  })
        verify = () => {
            const totals = Array(p.sequences).fill(0),
                values = expected.map(
                    item => (totals[item.seq] += item.duration),
                )
            const actual = ends.map(q => target.get(q))
            assert.deepEqual(actual, values)
            assert.deepEqual(
                items.map(q => target.get(q)),
                expected,
            )
            return { values, sequences: expected.map(x => x.seq) }
        }
    } else if (row.group === "dual-graph-shape") {
        const source = atom(1),
            gate = atom(false)
        let dependency
        if (p.forwardSelectorLeaves) {
            const leaves = Array.from(
                { length: p.forwardSelectorLeaves },
                (_, i) => selector(g => g(source) + i),
            )
            dependency = selector(g => leaves.reduce((sum, q) => sum + g(q), 0))
            target.get(dependency)
        } else {
            dependency = source
            for (let i = 0; i < p.forwardDepth; i++) {
                const previous = dependency
                dependency = selector(g => g(previous) + 1)
            }
            target.get(dependency)
        }
        const parent = selector(g => (g(gate) ? g(dependency) : 0))
        const watched = p.incomingWatchers
            ? Array.from({ length: p.incomingWatchers }, () =>
                  selector(g => g(parent)),
              )
            : [selector(g => g(parent))]
        watched.forEach(subscribe)
        execute = () => {
            for (let i = 0; i < p.newEdgeToggles; i++)
                target.set(gate, i % 2 === 0)
        }
        verify = () => {
            assert.equal(notifications, watched.length * p.newEdgeToggles)
            const values = watched.map(q => target.get(q))
            assert.deepEqual(values, Array(watched.length).fill(0))
            return values
        }
    } else if (row.group === "hydration") {
        // readHydrationSnapshot requires the actual Store identity, not a harness
        // facade. All adapter operations are counted explicitly in this lane.
        const live = api.store(),
            leaves = Array.from({ length: p.leaves }, (_, i) => atom(i)),
            selectors = Array.from({ length: p.selectors }, (_, i) =>
                selector(g => g(leaves[i % p.leaves]) * 2 + i),
            )
        selectors.forEach(q => live.get(q))
        let consumed = 0,
            reads = 0
        execute = () => {
            for (let i = 0; i < p.snapshots; i++)
                for (const q of selectors) {
                    consumed += adapter.readHydrationSnapshot(live, q)
                    reads++
                }
        }
        verify = () => {
            assert.equal(reads, p.snapshots * p.selectors)
            const values = selectors.map((_, i) => (i % p.leaves) * 2 + i)
            assert.equal(
                consumed,
                p.snapshots * values.reduce((a, b) => a + b, 0),
            )
            selectors.forEach((q, i) => assert.equal(live.get(q), values[i]))
            return { values, consumed, hydrationReads: reads }
        }
        m.roots.push(live)
    } else {
        const kind =
            row.group === "scope-routing"
                ? "scope"
                : row.group === "subscription-lifecycle"
                  ? "subscription"
                  : "scratch"
        const perform = await makeLegacy(kind, m.api, value => m.consume(value))
        batch = kind === "scope" ? 64 : kind === "subscription" ? 8 : 128
        execute =
            kind === "subscription"
                ? async () => {
                      for (let i = 0; i < batch; i++) await perform()
                  }
                : () => {
                      for (let i = 0; i < batch; i++) perform()
                  }
        verify = () => {
            const root = m.roots[1]
            assert.ok(root)
            if (kind === "scope") {
                assert.equal(root.get(m.atoms[0]), batch)
                return [batch]
            }
            if (kind === "scratch") {
                assert.equal(root.get(m.atoms[0]), batch)
                return [batch, batch + 1]
            }
            return [m.selectors.length, 100, 20]
        }
    }
    observer?.resetCounters({ trace: false })
    m.begin()
    const start = mode === "timed" ? performance.now() : null
    if (row.group === "subscription-lifecycle") await execute()
    else execute()
    const durationNs =
        mode === "timed" ? (performance.now() - start) * 1e6 : null
    const measured = m.end()
    const common = observer?.snapshot().common ?? null
    const outcome = verify()
    if (row.group === "hydration")
        measured.counts.hydrationRead = outcome.hydrationReads
    const checksum = hash({
        outcome,
        notifications,
        consumed: measured.consumed,
    })
    const publicOperations = Object.entries(measured.counts)
        .filter(([key]) => key !== "callback")
        .reduce((sum, [, count]) => sum + count, 0)
    if (common) {
        common.publicOperations = publicOperations
        common.checksum = checksum
        common.retainedHeapBytes = null
    }
    for (const root of m.roots) root.dispose()
    if (mode === "timed")
        assert.ok(
            durationNs >= (row.minimumAggregatedDurationNs ?? 1),
            "WORKLOAD-TIMING-FLOOR",
        )
    return {
        id: row.id,
        mode,
        durationNs,
        counts: {
            ...measured.counts,
            subscriberCallbacks: notifications,
            consumed: measured.consumed,
            batch,
            publicOperations,
        },
        checksum,
        common,
        core: null,
    }
}
