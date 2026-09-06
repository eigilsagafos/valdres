import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createSelectorOracle } from "../v1-model/selector-oracle.ts"
import {
    labeledDAGs,
    insertionClosesCycle,
    assertDAG,
    validateCyclePath,
    validateGraphRejection,
} from "./graph-oracle.mjs"
const digest = value =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex")
const capture = operation => {
    try {
        return { value: operation() }
    } catch (error) {
        return { error }
    }
}
const causes = error => {
    const result = []
    while (error !== undefined) {
        assert.ok(!result.includes(error), "cause cycle")
        result.push(error)
        error = error?.cause
    }
    return result
}
export function requireCircularCause(error, exportedClass) {
    const cause = causes(error).find(
        e => e?.name === "SelectorCircularDependencyError",
    )
    assert.ok(
        typeof exportedClass === "function" && cause instanceof exportedClass,
        "exported SelectorCircularDependencyError identity required",
    )
    return cause
}
const number = value => ({ kind: "number", value })

// Only this test observation protocol is shared. Implementations translate their
// own build-only data; no production entry point or search operation is shared.
export async function runSemanticCases({
    api,
    adapter,
    foreign,
    observer,
    manifest,
    only,
    mutation,
    stage = "A",
    emit = () => {},
}) {
    assert.ok(["C", "A"].includes(stage), "SEMANTIC-STAGE: unknown contract")
    const circular = error =>
        requireCircularCause(error, api.SelectorCircularDependencyError)
    const mutationTargets = {
        "false-negative-cycle": "C-GRAPH-001",
        "post-set-cycle": "C-GRAPH-001",
        "renamed-cycle-error": "C-GRAPH-001",
        "false-positive-cycle": "C-GRAPH-001",
        "offending-edge-installation": "A-GRAPH-001",
        "wrong-causal-blame": "A-GRAPH-001",
        "non-sticky-caught-fault": "C-CYCLE-005",
        "lost-prefix": "A-GRAPH-002",
        "notification-reorder": "A-SUB-001",
        "notification-duplication": "A-SUB-001",
        "equality-recovery-notification": "A-EQUAL-001",
        "scratch-publication-leak": "C-TXN-001",
        "hydration-publication-leak": "A-HYDRATE-001",
        "family-quarantine-bypass": "A-FAMILY-002",
    }
    if (mutation !== undefined) {
        assert.ok(
            Object.hasOwn(mutationTargets, mutation),
            "MUTATION-ID: unknown mutation",
        )
        assert.deepEqual(
            only,
            [mutationTargets[mutation]],
            "MUTATION-ID: mutation must run its exact fixture",
        )
        assert.ok(
            observer,
            "MUTATION-MODE: semantic red proofs require the counter artifact",
        )
    }
    const rows = []
    const { atom, selector, store, family } = api
    const fixtures = new Map()
    function fixture(id, body) {
        assert.ok(!fixtures.has(id))
        fixtures.set(id, body)
    }
    let cleanups, trace, identities, nextIdentity, counterTotals
    const resetObservation = options => {
        if (!observer) return
        for (const [key, value] of Object.entries(observer.snapshot().common))
            counterTotals[key] = (counterTotals[key] ?? 0) + value
        observer.reset(options)
    }
    const track = s => (cleanups.push(() => s.dispose()), s)
    const A = (id, value) => {
        const state = atom(value)
        observer?.label(state, id)
        return state
    }
    const S = (id, get, options) => {
        const state = selector(get, options)
        observer?.label(state, id)
        return state
    }
    const identity = value => {
        if (
            (typeof value === "object" && value !== null) ||
            typeof value === "function"
        ) {
            if (!identities.has(value))
                identities.set(value, `identity-${nextIdentity++}`)
            return identities.get(value)
        }
        return `${typeof value}:${String(value)}`
    }
    const note = (name, value) => trace.push({ name, value })
    const snap = () => {
        const result = observer?.snapshot()
        if (result && mutation === "lost-prefix") {
            for (const host of result.hosts)
                for (const row of host.records)
                    if (row.selector === "parent") row.dependencies = []
        }
        if (result && mutation === "hydration-publication-leak") {
            const published = result.events.find(
                e => e.type === "install" && e.selector === "q",
            )
            const root = result.hosts[0]
            if (
                published &&
                root &&
                !root.records.some(r => r.selector === "q")
            )
                root.records.push({ ...published, host: root.id })
        }
        return result
    }
    const record = (s, id) =>
        snap()
            ?.hosts.find(h => h.id === observer.hostOf(s))
            ?.records.find(r => r.selector === id)
    const deps = (s, id) => record(s, id)?.dependencies
    const expectDeps = (s, id, expected) => {
        if (observer) assert.deepEqual(deps(s, id), expected)
    }
    const snapshot = name => {
        if (observer) note(name, snap())
    }
    function expectFailure(operation, name) {
        const result = capture(operation)
        assert.ok(result.error, `expected ${name}`)
        assert.ok(
            causes(result.error).some(e => e.name === name),
            `expected ${name}, got ${causes(result.error).map(e => e.name)}`,
        )
        note("error", {
            names: causes(result.error).map(e => e.name),
            identity: identity(result.error),
        })
        return result.error
    }
    function graphCase(length, cached = false) {
        const s = track(store()),
            gate = A("gate", false)
        let nodes
        if (cached) {
            nodes = Array.from({ length }, (_, i) =>
                S(String(i), g =>
                    i === 0
                        ? g(gate)
                            ? g(nodes[1])
                            : 1
                        : g(nodes[(i + 1) % length]),
                ),
            )
            for (let i = 1; i < length; i++) s.get(nodes[i])
            s.set(gate, true)
        } else
            nodes = Array.from({ length }, (_, i) =>
                S(String(i), g => g(nodes[(i + 1) % length])),
            )
        const e = expectFailure(
            () => s.get(nodes[0]),
            "SelectorCircularDependencyError",
        )
        const c = circular(e)
        const oracle = createSelectorOracle(
            nodes.map((_, i) => ({
                kind: "selector",
                id: String(i),
                get: g =>
                    cached && i === 0 && !enabled
                        ? number(1)
                        : g(String((i + 1) % length)),
            })),
        )
        let enabled = !cached
        if (cached) {
            for (let i = 1; i < length; i++) oracle.evaluate(String(i))
            enabled = true
        }
        const expected = oracle.evaluate(
            "0",
            cached ? { current: nodes.map((_, i) => String(i)).slice(1) } : {},
        ).outcome
        let oe = expected.error
        while (oe?.cause) oe = oe.cause
        assert.equal(oe.kind, "cycle")
        if (stage === "A") {
            assert.equal(nodes.indexOf(c.selector), Number(oe.selector))
            assert.deepEqual(
                c.path.map(x => String(nodes.indexOf(x))),
                oe.path,
            )
        }
        const graph = nodes.map((_, i) => (i === length - 1 ? [] : [i + 1]))
        const installed = observer
            ? nodes.map((_, i) =>
                  (deps(s, String(i)) ?? [])
                      .filter(x => /^\d+$/.test(x))
                      .map(Number),
              )
            : null
        // For cached rejection the closing edge is 0->1; use its effective DAG.
        const parent = cached ? 0 : length - 1,
            dependency = cached ? 1 : 0
        if (cached)
            for (let i = 0; i < length; i++)
                graph[i] = i === 0 ? [] : [(i + 1) % length]
        validateGraphRejection(
            {
                parent,
                dependency,
                installed,
                value: null,
                blame: nodes.indexOf(c.selector),
                path: c.path.map(x => nodes.indexOf(x)),
            },
            graph,
            stage,
        )
        note("cycle", {
            selector: nodes.indexOf(c.selector),
            path: c.path.map(x => nodes.indexOf(x)),
        })
        snapshot("graph")
        return { s, nodes, c, e }
    }
    fixture("C-GRAPH-001", async () => {
        const hash = createHash("sha256")
        let graphCount = 0,
            attemptCount = 0,
            cycles = 0
        for (let n = 1; n <= 5; n++)
            for (const graph of labeledDAGs(n)) {
                const attempts = []
                for (let parent = 0; parent < n; parent++)
                    for (let dependency = 0; dependency < n; dependency++) {
                        resetObservation({ trace: false })
                        const gates = Array.from({ length: n }, (_, i) =>
                            A(`g${i}`, -1),
                        )
                        const nodes = graph.map((edges, i) =>
                            S(String(i), g => {
                                let sum = 1
                                for (const d of edges) sum += g(nodes[d])
                                const extra = g(gates[i])
                                if (extra >= 0) sum += g(nodes[extra])
                                return sum
                            }),
                        )
                        const s = store()
                        function installedGraph() {
                            if (!observer) return null
                            const graph = Array.from({ length: n }, () => [])
                            for (const record of observer
                                .snapshot()
                                .hosts.find(h => h.id === observer.hostOf(s))
                                .records)
                                graph[+record.selector] = record.dependencies
                                    .filter(d => /^\d+$/.test(d))
                                    .map(Number)
                            assertDAG(graph, "C-GRAPH-001")
                            return graph
                        }
                        const afterSetupReads = []
                        for (const node of nodes) {
                            s.get(node)
                            afterSetupReads.push(installedGraph())
                        }
                        let afterSet
                        const expected = insertionClosesCycle(
                            graph,
                            parent,
                            dependency,
                        )
                        const setter = capture(() =>
                            s.set(gates[parent], dependency),
                        )
                        afterSet = installedGraph()
                        if (mutation === "post-set-cycle" && afterSet)
                            afterSet[parent].push(parent)
                        if (afterSet) assertDAG(afterSet, "C-GRAPH-001")
                        const actual = setter.error
                            ? setter
                            : capture(() => s.get(nodes[parent]))
                        if (mutation === "false-negative-cycle" && expected)
                            delete actual.error
                        if (mutation === "false-positive-cycle" && !expected)
                            actual.error = Error("mutated false positive")
                        assert.equal(
                            Boolean(actual.error),
                            expected,
                            JSON.stringify({
                                graph,
                                parent,
                                dependency,
                                expected,
                            }),
                        )
                        let installed = installedGraph(),
                            path,
                            blame
                        if (mutation === "renamed-cycle-error" && expected) {
                            const cause = circular(actual.error)
                            actual.error = Object.assign(
                                new Error("test-only renamed ordinary Error"),
                                {
                                    name: "SelectorCircularDependencyError",
                                    selector: cause.selector,
                                    path: cause.path,
                                },
                            )
                        }
                        if (expected) {
                            cycles++
                            const c = circular(actual.error)
                            assert.ok(c)
                            blame = nodes.indexOf(c.selector)
                            path = c.path.map(x => nodes.indexOf(x))
                            validateGraphRejection(
                                {
                                    parent,
                                    dependency,
                                    installed: installed ?? null,
                                    path,
                                    blame,
                                    value: null,
                                },
                                graph,
                                stage,
                            )
                        } else {
                            const expanded = graph.map((edges, i) =>
                                i === parent ? [...edges, dependency] : edges,
                            )
                            const read = i =>
                                1 +
                                expanded[i].reduce((sum, j) => sum + read(j), 0)
                            assert.equal(actual.value, read(parent))
                            if (installed)
                                assert.deepEqual(installed[parent], [
                                    ...new Set(expanded[parent]),
                                ])
                        }
                        attempts.push({
                            parent,
                            dependency,
                            cycle: expected,
                            exportedCycleError: expected
                                ? circular(actual.error) instanceof
                                  api.SelectorCircularDependencyError
                                : null,
                            afterSetupReads,
                            afterSet: afterSet ?? null,
                            value: actual.value ?? null,
                            blame: blame ?? null,
                            path: path ?? null,
                            installed: installed ?? null,
                        })
                        s.dispose()
                        attemptCount++
                    }
                const raw = { id: "C-GRAPH-001", n, graph, attempts }
                hash.update(JSON.stringify(raw))
                emit(raw)
                graphCount++
                // End the JS job so WeakRef keep-alive sets and queued lifecycle work
                // can drain. This is semantic enumeration, never a latency sample.
                if (graphCount % 16 === 0)
                    await new Promise(resolve => setImmediate(resolve))
            }
        assert.equal(graphCount, 29853)
        assert.equal(attemptCount, 740951) // replaced below by independently computed inventory total
        resetObservation()
        note("exhaustive", {
            graphs: graphCount,
            attempts: attemptCount,
            cycles,
            rawSha256: hash.digest("hex"),
        })
    })
    fixture("C-CYCLE-001", () => graphCase(1))
    fixture("C-CYCLE-002", () => graphCase(3))
    fixture("C-CYCLE-003", () => graphCase(2, true))
    fixture("C-CYCLE-004", () => graphCase(4, true))
    function sticky() {
        const s = track(store()),
            a = A("a", 1)
        let parent,
            first,
            second,
            laterEntries = 0
        const child = S("child", g => g(a)),
            later = S("later", () => ++laterEntries)
        parent = S("parent", g => {
            g(child)
            g(child)
            try {
                g(parent)
            } catch (e) {
                first = e
            }
            try {
                g(later)
            } catch (e) {
                second = e
            }
            throw Error("replacement")
        })
        let error = capture(() => s.get(parent)).error
        if (mutation === "non-sticky-caught-fault") error = Error("replacement")
        assert.equal(error, first)
        assert.equal(second, first)
        assert.equal(laterEntries, 0)
        expectDeps(s, "parent", ["child"])
        expectDeps(s, "child", ["a"])
        note("sticky", {
            sameFirst: identity(error) === identity(first),
            sameLater: identity(second) === identity(first),
            laterEntries,
        })
        snapshot("prefix")
        return { s, parent, child, error }
    }
    fixture("C-CYCLE-005", sticky)
    fixture("A-ERROR-001", sticky)
    fixture("A-GRAPH-002", () => {
        const { s } = sticky()
        expectDeps(s, "parent", ["child"])
    })
    fixture("A-GRAPH-006", () => {
        const { s, child } = sticky()
        const before = snap()?.common.selectorBodyEntries
        assert.equal(s.get(child), 1)
        if (observer) assert.equal(snap().common.selectorBodyEntries, before)
    })
    fixture("A-GRAPH-001", () => {
        const { s, nodes, c } = graphCase(3)
        const parent = 2,
            dependency = 0
        let blame = nodes.indexOf(c.selector)
        if (mutation === "wrong-causal-blame") blame = 1
        assert.equal(blame, parent)
        const installed = nodes.map((_, i) =>
            (deps(s, String(i)) ?? []).filter(x => /^\d+$/.test(x)).map(Number),
        )
        if (mutation === "offending-edge-installation")
            installed[parent].push(dependency)
        if (observer)
            validateCyclePath({
                path: c.path.map(x => nodes.indexOf(x)),
                parent,
                dependency,
                effective: [[1], [2], []],
                installed,
            })
    })
    fixture("C-STORE-001", () => {
        const s = track(store()),
            gate = A("gate", false)
        let p
        p = S("p", g => (g(gate) ? g(p) : 1))
        s.sub(p, () => {})
        s.set(gate, true)
        assert.equal(s.get(gate), true)
        expectFailure(() => s.get(p), "SelectorCircularDependencyError")
        assert.equal(s.get(gate), true)
        s.set(gate, false)
        assert.equal(s.get(p), 1)
        note("finalSource", true)
    })
    function transaction() {
        const s = track(store()),
            a = A("a", 1),
            q = S("q", g => g(a) * 2),
            notifications = []
        s.sub(q, () => notifications.push(s.get(q)))
        let tx
        const abort = Error("abort")
        assert.equal(
            capture(() =>
                s.txn(t => {
                    tx = t
                    t.set(a, 2)
                    assert.equal(t.get(q), 4)
                    t.set(a, 3)
                    assert.equal(t.get(q), 6)
                    throw abort
                }),
            ).error,
            abort,
        )
        let value = s.get(q)
        if (mutation === "scratch-publication-leak") value = 6
        assert.equal(value, 2)
        assert.deepEqual(notifications, [])
        expectFailure(() => tx.get(q), "TransactionClosedError")
        s.txn(t => {
            t.set(a, 4)
            assert.equal(t.get(q), 8)
            t.set(a, 5)
            assert.equal(t.get(q), 10)
        })
        assert.equal(s.get(q), 10)
        assert.deepEqual(notifications, [10])
        note("committed", notifications)
        snapshot("generations")
    }
    fixture("C-TXN-001", transaction)
    fixture("A-TXN-001", transaction)
    fixture("C-SUB-001", async () => {
        const s = track(store()),
            a = A("a", 0),
            q = S("q", g => g(a) * 2),
            seen = []
        s.sub(q, () => seen.push("q"))
        s.txn(t => {
            t.set(a, 1)
            t.set(a, 2)
        })
        assert.deepEqual(seen, ["q"])
        await Promise.resolve()
        await new Promise(r => setTimeout(r, 0))
        assert.deepEqual(seen, ["q"])
        note("notification", seen)
    })
    function scope() {
        const s = track(store()),
            a = A("a", 1),
            q = S("q", g => g(a))
        const child = s.scope("child"),
            grandchild = child.scope("grandchild")
        let notified = 0
        grandchild.sub(q, () => notified++)
        child.set(a, 2)
        assert.equal(grandchild.get(q), 2)
        assert.equal(s.get(q), 1)
        child.dispose()
        expectFailure(() => grandchild.get(q), "StoreDisposedError")
        const replacement = s.scope("child")
        assert.equal(replacement.get(q), 1)
        s.set(a, 3)
        assert.equal(replacement.get(q), 3)
        assert.equal(notified, 1)
        note("scopeValues", [1, 2, 1, 3])
        snapshot("hosts")
    }
    fixture("C-SCOPE-001", scope)
    fixture("A-SCOPE-001", scope)
    fixture("A-GRAPH-003", () => {
        const s = track(store()),
            pg = A("pg", false),
            cg = A("cg", false),
            lg = A("lg", false)
        let parent, cached
        const changed = S("changed", g => (g(cg) ? g(cached) : 1)),
            edge = S("edge", g => g(changed))
        parent = S("parent", g => (g(pg) ? g(edge) : 1))
        cached = S("cached", g => g(parent))
        const later = S("later", g => (g(lg) ? 1 : g(changed)))
        for (const x of [edge, cached, later]) assert.equal(s.get(x), 1)
        s.txn(t => {
            t.set(pg, true)
            t.set(cg, true)
            t.set(lg, true)
        })
        const e = circular(
            expectFailure(
                () => s.get(parent),
                "SelectorCircularDependencyError",
            ),
        )
        assert.equal(e.selector, parent)
        assert.deepEqual(e.path, [parent, edge, changed, cached, parent])
        expectDeps(s, "parent", ["pg"])
        assert.equal(s.get(later), 1)
        s.set(pg, false)
        assert.equal(s.get(parent), 1)
        s.set(cg, false)
        s.set(pg, true)
        assert.equal(s.get(parent), 1)
        expectDeps(s, "parent", ["pg", "edge"])
        snapshot("recovery")
    })
    fixture("A-GRAPH-004", () => {
        const s = track(store()),
            a = A("a", 1)
        let p, c
        p = S("parent", g => {
            g(a)
            return g(c)
        })
        c = S("child", g => g(p))
        const e = circular(
            expectFailure(() => s.get(p), "SelectorCircularDependencyError"),
        )
        assert.equal(e.selector, c)
        assert.deepEqual(e.path, [p, c, p])
        expectDeps(s, "parent", ["a", "child"])
        expectDeps(s, "child", [])
        snapshot("transient")
    })
    fixture("A-GRAPH-005", () => {
        for (const phase of ["comparator", "then-accessor"]) {
            const s = track(store()),
                a = A("a", 0)
            let armed = false,
                first
            const illegal = () => {
                try {
                    s.set(a, 7)
                } catch (e) {
                    first = e
                }
                return false
            }
            const q = S("q", g => g(a), {
                equal: () =>
                    armed
                        ? phase === "comparator"
                            ? illegal()
                            : {
                                  get then() {
                                      illegal()
                                      return undefined
                                  },
                              }
                        : false,
            })
            s.get(q)
            armed = true
            s.set(a, 1)
            if (phase === "comparator") assert.equal(s.get(q), 1)
            else
                expectFailure(
                    () => s.get(q),
                    "InvalidSelectorComparatorResultError",
                )
            assert.equal(first?.name, "SelectorCapabilityError")
            assert.equal(s.get(a), 1)
            expectDeps(s, "q", ["a"])
            note("finalization", phase)
        }
    })
    fixture("A-CURRENT-001", () => {
        const s = track(store()),
            a = A("a", 0)
        let entries = 0
        const q = S("q", g => {
            entries++
            return g(a) + 1
        })
        assert.equal(s.get(q), 1)
        for (let i = 0; i < 8; i++) assert.equal(s.get(q), 1)
        assert.equal(entries, 1)
        s.set(a, 1)
        assert.equal(s.get(q), 2)
        assert.equal(entries, 2)
        s.set(a, 1)
        s.get(q)
        assert.equal(entries, 2)
        note("entries", entries)
    })
    fixture("A-ERROR-002", () => {
        const s = track(store()),
            a = A("a", 0),
            problem = Error("ordinary")
        let entries = 0
        const q = S("q", g => {
            entries++
            if (g(a) === 0) throw problem
            return 7
        })
        const first = expectFailure(() => s.get(q), "SelectorGetterError")
        assert.equal(capture(() => s.get(q)).error, first)
        assert.equal(entries, 1)
        assert.equal(first.cause, problem)
        s.set(a, 1)
        assert.equal(s.get(q), 7)
        assert.equal(entries, 2)
        note("errorRecovery", true)
    })
    fixture("A-EQUAL-001", () => {
        const s = track(store()),
            a = A("a", 1),
            problem = Error("ordinary"),
            calls = [],
            seen = []
        let parentEntries = 0
        const q = S(
            "q",
            g => {
                const value = g(a)
                if (value < 0) throw problem
                return { value }
            },
            {
                equal: (previous, next) => {
                    calls.push([previous.value, next.value])
                    return previous.value % 2 === next.value % 2
                },
            },
        )
        const parent = S("parent", g => {
            parentEntries++
            return g(q).value
        })
        s.sub(parent, () => {
            const result = capture(() => s.get(parent))
            seen.push(result.error ? "error" : result.value)
        })
        const first = s.get(q)
        s.set(a, 3)
        assert.equal(s.get(q), first)
        assert.equal(parentEntries, 1)
        s.set(a, -1)
        expectFailure(() => s.get(q), "SelectorGetterError")
        s.set(a, 5)
        assert.equal(s.get(q), first)
        assert.ok(calls.every(x => x[0] === 1))
        s.set(a, 2)
        assert.equal(s.get(q).value, 2)
        if (mutation === "equality-recovery-notification") seen.length = 0
        assert.deepEqual(calls, [
            [1, 3],
            [1, 5],
            [1, 2],
        ])
        assert.deepEqual(seen, ["error", 1, 2])
        note("comparisons", calls)
        note("notifications", seen)
    })
    fixture("A-FAULT-001", async () => {
        const phases = manifest.semanticCases.find(x => x.id === "A-FAULT-001")
            .parameters.thenablePhases
        const unhandled = []
        const listener = e => unhandled.push(e)
        process.on("unhandledRejection", listener)
        try {
            for (const phase of phases)
                for (const settlement of ["resolve", "reject"]) {
                    const s = track(store()),
                        a = A("a", 0)
                    let contained = 0
                    let settle
                    const promise = new Promise((resolve, reject) => {
                        settle = settlement === "resolve" ? resolve : reject
                    })
                    const nativeThen = promise.then
                    promise.then = function (yes, no) {
                        contained++
                        assert.equal(typeof no, "function")
                        return nativeThen.call(this, yes, no)
                    }
                    const bad = () => {
                        if (phase.endsWith("throw")) throw promise
                        return promise
                    }
                    const q = phase.startsWith("getter")
                        ? S("q", bad)
                        : S("q", g => g(a), { equal: bad })
                    if (phase.startsWith("comparator")) {
                        s.get(q)
                        s.set(a, 1)
                    }
                    const first = expectFailure(
                        () => s.get(q),
                        "InvalidSynchronousSelectorResultError",
                    )
                    assert.equal(contained, 1)
                    settle(99)
                    await Promise.resolve()
                    await new Promise(r => setTimeout(r, 0))
                    assert.equal(capture(() => s.get(q)).error, first)
                    note("thenable", {
                        phase,
                        settlement,
                        contained,
                        neverSettled: true,
                    })
                }
            const s = track(store()),
                a = A("revoked-source", 1)
            let borrowed
            const q = S("revoked", g => {
                borrowed = g
                return g(a)
            })
            s.get(q)
            expectFailure(() => borrowed(a), "SelectorReadRevokedError")
            for (const result of [1, null, undefined]) {
                const a = A("invalid-source", 0),
                    q = S("invalid", g => g(a), { equal: () => result })
                s.get(q)
                s.set(a, 1)
                expectFailure(
                    () => s.get(q),
                    "InvalidSelectorComparatorResultError",
                )
            }
            const hostile = Error("hostile")
            assert.equal(
                expectFailure(
                    () =>
                        s.get(
                            S("hostile", () => ({
                                get then() {
                                    throw hostile
                                },
                            })),
                        ),
                    "SelectorGetterError",
                ).cause,
                hostile,
            )
            assert.deepEqual(unhandled, [])
        } finally {
            process.off("unhandledRejection", listener)
        }
    })
    fixture("A-SUB-001", async () => {
        const s = track(store()),
            a = A("a", 0),
            b = A("b", 0),
            left = S("left", g => g(a)),
            right = S("right", g => g(b)),
            both = S("both", g => g(left) + g(right)),
            seen = []
        s.sub(right, () => seen.push("right"))
        s.sub(left, () => seen.push("left-1"))
        s.sub(left, () => seen.push("left-2"))
        s.sub(both, () => seen.push("both"))
        s.txn(t => {
            t.set(a, 1)
            t.set(b, 1)
        })
        if (mutation === "notification-reorder") seen.reverse()
        if (mutation === "notification-duplication") seen.push("both")
        assert.deepEqual(seen, ["left-1", "left-2", "right", "both"])
        await Promise.resolve()
        await new Promise(r => setTimeout(r, 0))
        assert.deepEqual(seen, ["left-1", "left-2", "right", "both"])
        note("order", seen)
    })
    fixture("A-SUB-002", () => {
        const s = track(store()),
            a = A("a", 0),
            seen = []
        let fault
        s.sub(a, () => {
            seen.push("first")
            try {
                s.set(a, 9)
            } catch (e) {
                fault = e
            }
            throw Error("subscriber")
        })
        s.sub(a, () => seen.push("second"))
        const e = expectFailure(
            () => s.set(a, 1),
            "SubscriberNotificationError",
        )
        assert.equal(fault?.name, "CallbackCapabilityError")
        assert.equal(e.committed, true)
        assert.equal(s.get(a), 1)
        assert.deepEqual(seen, ["first", "second"])
        note("isolated", seen)
    })
    fixture("A-HYDRATE-001", () => {
        const s = track(store()),
            a = A("a", 1)
        let entries = 0,
            equalities = 0
        const q = S(
            "q",
            g => {
                entries++
                return g(a) * 2
            },
            {
                equal: () => {
                    equalities++
                    return false
                },
            },
        )
        assert.equal(adapter.readHydrationSnapshot(s, q), 2)
        assert.equal(entries, 1)
        if (observer) assert.equal(record(s, "q"), undefined)
        assert.equal(s.get(q), 2)
        assert.equal(entries, 2)
        assert.equal(adapter.readHydrationSnapshot(s, q), 2)
        assert.equal(entries, 3)
        s.get(q)
        assert.equal(entries, 3)
        assert.equal(equalities, 0)
        const problem = Error("hydration")
        const broken = S("broken", () => {
            throw problem
        })
        const he = expectFailure(
                () => adapter.readHydrationSnapshot(s, broken),
                "SelectorGetterError",
            ),
            le = expectFailure(() => s.get(broken), "SelectorGetterError")
        assert.equal(he.cause, problem)
        assert.equal(le.cause, problem)
        assert.notEqual(he, le)
        if (observer) {
            const events = snap().events
            const hydrationHosts = events
                .filter(e => e.type === "host" && e.kind === "hydration")
                .map(e => e.id)
            for (const h of hydrationHosts)
                assert.ok(events.some(e => e.type === "clear" && e.host === h))
        }
        note("hydration", { entries, equalities })
        snapshot("isolation")
    })
    fixture("A-DOMAIN-001", () => {
        assert.ok(foreign)
        const s = track(store()),
            child = s.scope("child")
        let entries = 0
        const a = foreign.atom(1),
            q = foreign.selector(() => ++entries)
        for (const state of [a, q])
            for (const read of [
                () => s.get(state),
                () => child.get(state),
                () => s.txn(t => t.get(state)),
                () => adapter.readHydrationSnapshot(s, state),
            ])
                expectFailure(read, "RuntimeMismatchError")
        assert.equal(entries, 0)
        note("foreignWork", entries)
    })
    fixture("A-FAMILY-001", () => {
        const s = track(store())
        let definitions = 0
        const members = family(key => {
                definitions++
                return atom(key)
            }),
            derived = family(key => selector(g => g(members(key)) * 2))
        assert.equal(members(3), members(3))
        assert.equal(s.get(derived(3)), 6)
        const child = s.scope("family")
        child.set(members(3), 4)
        assert.equal(child.get(derived(3)), 8)
        assert.equal(s.get(derived(3)), 6)
        s.txn(t => {
            t.set(members(3), 5)
            assert.equal(t.get(derived(3)), 10)
        })
        assert.equal(adapter.readHydrationSnapshot(s, derived(3)), 10)
        assert.equal(definitions, 1)
        note("familyCompatibility", { definitions, scoring: false })
    })
    fixture("A-FAMILY-002", () => {
        const s = track(store()),
            a = A("a", 1)
        let get, first
        const members = family(() => {
            try {
                get(a)
            } catch (e) {
                first = e
            }
            return atom(4)
        })
        const q = S("q", g => {
            get = g
            return g(members("one"))
        })
        let result = capture(() => s.get(q))
        if (mutation === "family-quarantine-bypass") result = { value: 4 }
        assert.ok(result.error)
        assert.ok(
            causes(result.error).some(
                e => e.name === "CallbackCapabilityError",
            ),
        )
        assert.equal(result.error, first)
        note("familyQuarantine", true)
    })
    fixture("A-FUZZ-001", () => {
        const parameters = manifest.semanticCases.find(
            x => x.id === "A-FUZZ-001",
        ).parameters
        for (const seed of parameters.seeds) {
            const repeats = []
            for (
                let repeat = 0;
                repeat < parameters.repeatForDeterminism;
                repeat++
            ) {
                resetObservation({ trace: false })
                const s = store(),
                    leaves = Array.from({ length: 5 }, (_, i) => A(`a${i}`, i)),
                    gate = A("gate", 0)
                const definitions = [
                    ...leaves.map((_, i) => ({
                        kind: "leaf",
                        id: `a${i}`,
                        state: { kind: "value", value: number(i) },
                    })),
                    {
                        kind: "leaf",
                        id: "gate",
                        state: { kind: "value", value: number(0) },
                    },
                ]
                const states = []
                for (let i = 0; i < 5; i++) {
                    states.push(
                        S(
                            `s${i}`,
                            g =>
                                g(leaves[(g(gate) + i) % 5]) +
                                (i ? g(states[(g(gate) + i) % i]) : 0),
                        ),
                    )
                    definitions.push({
                        kind: "selector",
                        id: `s${i}`,
                        get: g =>
                            number(
                                g(`a${(g("gate").value + i) % 5}`).value +
                                    (i
                                        ? g(`s${(g("gate").value + i) % i}`)
                                              .value
                                        : 0),
                            ),
                    })
                }
                const oracle = createSelectorOracle(definitions)
                let random = seed >>> 0
                const output = []
                for (
                    let step = 0;
                    step < parameters.operationsPerSeed;
                    step++
                ) {
                    random ^= random << 13
                    random ^= random >>> 17
                    random ^= random << 5
                    const value = (random >>> 0) % 100
                    if (step % 3 === 0) {
                        s.set(gate, value % 5)
                        oracle.setLeafValue("gate", number(value % 5))
                    } else {
                        const index = value % 5
                        s.set(leaves[index], value)
                        oracle.setLeafValue(`a${index}`, number(value))
                    }
                    const id = value % 5
                    const expected = oracle.evaluate(`s${id}`).outcome
                    assert.equal(expected.kind, "value")
                    const actual = s.get(states[id])
                    assert.equal(actual, expected.value.value)
                    output.push(actual)
                }
                repeats.push(digest(output))
                emit({ id: "A-FUZZ-001", seed, repeat, values: output })
                s.dispose()
            }
            assert.equal(repeats[0], repeats[1])
            note("fuzz", {
                seed,
                operations: parameters.operationsPerSeed,
                repeatedDigest: repeats[0],
            })
        }
        resetObservation()
    })
    assert.deepEqual(
        [...fixtures.keys()].sort(),
        manifest.semanticCases.map(x => x.id).sort(),
    )
    for (const id of only ?? manifest.semanticCases.map(x => x.id)) {
        assert.ok(fixtures.has(id), `unknown semantic ID ${id}`)
        cleanups = []
        trace = []
        identities = new WeakMap()
        nextIdentity = 1
        counterTotals = {}
        observer?.reset()
        try {
            await fixtures.get(id)()
            for (const dispose of cleanups.reverse()) dispose()
            if (observer)
                for (const [key, value] of Object.entries(
                    observer.snapshot().common,
                ))
                    counterTotals[key] = (counterTotals[key] ?? 0) + value
            const row = {
                id,
                status: "pass",
                trace,
                traceSha256: digest(trace),
                common: observer ? counterTotals : null,
                mode: observer ? "counter" : "public",
            }
            rows.push(row)
            emit(row)
        } catch (error) {
            for (const dispose of cleanups.reverse()) capture(dispose)
            throw new Error(`${id}: ${error.message}`, { cause: error })
        }
    }
    return rows
}
