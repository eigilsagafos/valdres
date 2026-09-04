// Admission only: exercise public operations; never emit tournament passes.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
const [root, other, manifestPath] = process.argv.slice(2)
const api = await import(pathToFileURL(root + "/dist/index.js"))
const adapter = await import(
    pathToFileURL(root + "/dist/adapter-internals/v1.js")
)
const foreign = await import(pathToFileURL(other + "/dist/index.js"))
const { atom, selector, store, family } = api
const m = JSON.parse(readFileSync(manifestPath))
const evidence = []
const capture = fn => {
    try {
        return { value: fn() }
    } catch (error) {
        return { error }
    }
}
const chain = e => {
    const a = []
    for (; e; e = e.cause) {
        a.push(e)
        if (a.length > 20) throw Error("cause loop")
    }
    return a
}
function probe(ids, fn) {
    try {
        evidence.push({ ids, executable: true, facts: fn() ?? null })
    } catch (error) {
        evidence.push({
            ids,
            executable: false,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        })
    }
}
probe(
    ["C-GRAPH-001", "C-CYCLE-001", "C-CYCLE-002", "A-GRAPH-001", "A-GRAPH-004"],
    () => {
        const s = store()
        let a, b
        a = selector(g => g(b))
        b = selector(g => g(a))
        const e = chain(capture(() => s.get(a)).error)
        const circular = e.at(-1)
        assert.equal(circular.name, "SelectorCircularDependencyError")
        assert.equal(circular.selector, b)
        assert.deepEqual(circular.path, [a, b, a])
        let self
        self = selector(g => g(self))
        assert.equal(
            chain(capture(() => s.get(self)).error).at(-1).name,
            "SelectorCircularDependencyError",
        )
        s.dispose()
        return {
            activePath: ["a", "b", "a"],
            blame: "b",
            causeChain: e.map(x => x.name),
        }
    },
)
probe(["C-CYCLE-003", "C-CYCLE-004", "A-GRAPH-003"], () => {
    const s = store()
    const pGate = atom(false),
        cGate = atom(false),
        lGate = atom(false)
    let parent, cached
    const changed = selector(g => (g(cGate) ? g(cached) : 1))
    const newEdge = selector(g => g(changed))
    parent = selector(g => (g(pGate) ? g(newEdge) : 1))
    cached = selector(g => g(parent))
    const later = selector(g => (g(lGate) ? 1 : g(changed)))
    for (const x of [newEdge, cached, later]) assert.equal(s.get(x), 1)
    s.txn(t => {
        t.set(pGate, true)
        t.set(cGate, true)
        t.set(lGate, true)
    })
    const e = chain(capture(() => s.get(parent)).error).at(-1)
    assert.equal(e.name, "SelectorCircularDependencyError")
    const names = new Map([
        [parent, "parent"],
        [newEdge, "newEdge"],
        [changed, "changed"],
        [cached, "cached"],
    ])
    const facts = {
        cachedPath: e.path.map(x => names.get(x)),
        blame: names.get(e.selector),
    }
    s.dispose()
    return facts
})
probe(["C-CYCLE-005", "A-GRAPH-002", "A-GRAPH-006", "A-ERROR-001"], () => {
    const s = store()
    const a = atom(1)
    let p,
        caught,
        late = 0,
        childCount = 0
    const child = selector(g => {
            childCount++
            return g(a)
        }),
        last = selector(() => ++late)
    p = selector(g => {
        g(child)
        try {
            g(p)
        } catch (e) {
            caught = e
        }
        try {
            g(last)
        } catch (e) {
            assert.equal(e, caught)
        }
        return 2
    })
    const e = capture(() => s.get(p)).error
    assert.equal(e, caught)
    assert.equal(late, 0)
    assert.equal(s.get(child), 1)
    assert.equal(childCount, 1)
    s.dispose()
    return { sticky: true, late, childCount }
})
probe(["A-GRAPH-005"], () => {
    const s = store(),
        a = atom(0)
    let bad = false
    const q = selector(g => g(a), {
        equal: () => {
            if (bad) s.set(a, 4)
            return false
        },
    })
    s.get(q)
    bad = true
    const e = capture(() => {
        s.set(a, 1)
        s.get(q)
    }).error
    assert.equal(chain(e).at(-1).name, "SelectorCapabilityError")
    assert.equal(s.get(a), 1)
    s.dispose()
    return {
        publicFinalization: "same-domain mutation quarantined",
        syntheticNestedPublication: false,
    }
})
probe(
    [
        "C-STORE-001",
        "C-TXN-001",
        "A-TXN-001",
        "C-SUB-001",
        "A-SUB-001",
        "A-SUB-002",
        "A-CURRENT-001",
        "A-ERROR-002",
        "A-EQUAL-001",
    ],
    () => {
        const s = store(),
            a = atom(0),
            log = []
        let entries = 0
        const q = selector(g => {
            entries++
            return g(a) * 2
        })
        const off = s.sub(q, () => log.push("a"))
        s.sub(q, () => log.push("b"))
        s.set(a, 1)
        assert.deepEqual(log, ["a", "b"])
        const n = entries
        s.get(q)
        assert.equal(entries, n)
        const abort = Error("abort")
        assert.equal(
            capture(() =>
                s.txn(t => {
                    t.set(a, 99)
                    assert.equal(t.get(q), 198)
                    throw abort
                }),
            ).error,
            abort,
        )
        assert.equal(s.get(q), 2)
        s.txn(t => {
            t.set(a, 2)
            assert.equal(t.get(q), 4)
            t.set(a, 3)
            assert.equal(t.get(q), 6)
        })
        const ordinary = Error("ordinary")
        const err = selector(g => {
            g(a)
            throw ordinary
        })
        const one = capture(() => s.get(err)).error
        assert.equal(capture(() => s.get(err)).error, one)
        const eqCalls = []
        const eq = selector(g => g(a), {
            equal: (p, n) => {
                eqCalls.push([p, n])
                return true
            },
        })
        s.get(eq)
        s.set(a, 4)
        s.get(eq)
        assert.ok(eqCalls.length)
        let blocked
        s.sub(a, () => {
            blocked = capture(() => s.set(a, 7)).error
        })
        capture(() => s.set(a, 5))
        assert.equal(blocked.name, "CallbackCapabilityError")
        assert.equal(s.get(a), 5)
        off()
        s.dispose()
        return {
            methods: ["get", "set", "sub", "txn"],
            observedCurrentness: true,
        }
    },
)
probe(["C-SCOPE-001", "A-SCOPE-001"], () => {
    const s = store(),
        a = atom(1),
        q = selector(g => g(a))
    let c = s.scope("c")
    assert.equal(c.get(q), 1)
    c.set(a, 2)
    assert.equal(c.get(q), 2)
    assert.equal(s.get(q), 1)
    c.dispose()
    c = s.scope("c")
    assert.equal(c.get(q), 1)
    s.dispose()
})
probe(["A-FAULT-001"], () => {
    const facts = []
    for (const phase of m.semanticCases.find(x => x.id === "A-FAULT-001")
        .parameters.thenablePhases) {
        const s = store(),
            a = atom(0)
        let contains = 0
        const thenable = {
            then(_yes, no) {
                contains++
                no?.(Error("rejected"))
            },
        }
        const bad = () => {
            if (phase.endsWith("throw")) throw thenable
            return thenable
        }
        const q = phase.startsWith("getter")
            ? selector(bad)
            : selector(g => g(a), { equal: bad })
        if (phase.startsWith("comparator")) s.get(q)
        const e = capture(() =>
            phase.startsWith("getter") ? s.get(q) : (s.set(a, 1), s.get(q)),
        ).error
        facts.push({ phase, names: chain(e).map(x => x.name), contains })
        assert.ok(e)
        assert.ok(contains > 0)
        s.dispose()
    }
    return facts
})
probe(["A-HYDRATE-001"], () => {
    const s = store(),
        a = atom(1)
    let count = 0
    const q = selector(g => {
        count++
        return g(a) * 2
    })
    assert.equal(adapter.readHydrationSnapshot(s, q), 2)
    assert.equal(count, 1)
    assert.equal(s.get(q), 2)
    assert.equal(count, 2)
    adapter.readHydrationSnapshot(s, q)
    assert.equal(count, 3)
    s.get(q)
    assert.equal(count, 3)
    const e = Error("sync")
    const f = selector(() => {
        throw e
    })
    const x = chain(capture(() => adapter.readHydrationSnapshot(s, f)).error),
        y = chain(capture(() => s.get(f)).error)
    assert.deepEqual(
        x.map(x => x.name),
        y.map(x => x.name),
    )
    assert.equal(x.at(-1), e)
    s.dispose()
    return {
        coldHydrationDoesNotWarmLive: true,
        warmHydrationDoesNotReplaceLive: true,
    }
})
probe(["A-DOMAIN-001"], () => {
    const s = store(),
        a = foreign.atom(1),
        child = s.scope("child")
    for (const read of [
        () => s.get(a),
        () => child.get(a),
        () => s.txn(t => t.get(a)),
        () => adapter.readHydrationSnapshot(s, a),
    ])
        assert.equal(capture(read).error.name, "RuntimeMismatchError")
    s.dispose()
})
probe(["A-FAMILY-001", "A-FAMILY-002"], () => {
    const s = store()
    const members = family(k => atom(k))
    const q = selector(g => g(members(3)))
    assert.equal(s.get(q), 3)
    let borrowed
    const bad = family(() => {
        borrowed(members(3))
        return atom(4)
    })
    const f = selector(g => {
        borrowed = g
        return g(bad("x"))
    })
    assert.ok(
        chain(capture(() => s.get(f)).error).some(
            e => e.name === "CallbackCapabilityError",
        ),
    )
    s.dispose()
})
probe(["A-FUZZ-001"], () => {
    const s = store(),
        toggle = atom(0),
        a = atom(1),
        b = atom(2),
        q = selector(g => (g(toggle) % 2 ? g(a) : g(b)))
    for (let i = 0; i < 2048; i++) {
        s.set(toggle, i)
        assert.equal(s.get(q), i % 2 ? 1 : 2)
    }
    s.dispose()
    return { dynamicOperations: 2048 }
})
// Full cardinalities, public API only. This is an admission check, not a timing or memory pass.
for (const row of m.performanceWorkloads.filter(
    x => x.group !== "packed-core-load",
))
    probe([row.id], () => {
        const s = store(),
            a = atom(0)
        const p = row.parameters ?? {}
        let selectors = []
        if (row.id === "P-NEG-ATOM-2048") {
            const atoms = Array.from({ length: p.atoms }, () => atom(0))
            for (let i = 0; i < p.commits; i++)
                s.txn(t => {
                    for (let j = 0; j < p.writesPerCommit; j++)
                        t.set(
                            atoms[(i * p.writesPerCommit + j) % atoms.length],
                            i + 1,
                        )
                })
        } else if (row.group.startsWith("rewire")) {
            const items = Array.from({ length: p.items }, (_, i) =>
                atom(i % p.sequences),
            )
            const sequences = Array.from({ length: p.sequences }, (_, i) =>
                selector(
                    g => items.flatMap((a, j) => (g(a) === i ? [j] : [])),
                    {
                        equal: (a, b) =>
                            a.length === b.length &&
                            a.every((x, i) => Object.is(x, b[i])),
                    },
                ),
            )
            selectors = items.map(a => selector(g => g(sequences[g(a)]).length))
            for (const q of selectors)
                for (let i = 0; i < p.subscribersPerItem; i++)
                    s.sub(q, () => {})
            const change = (t, i) =>
                t.set(
                    items[i % items.length],
                    (t.get(items[i % items.length]) + 1) % p.sequences,
                )
            if (p.moves) for (let i = 0; i < p.moves; i++) change(s, i)
            else
                s.txn(t => {
                    for (let i = 0; i < p.changes; i++) change(t, i)
                })
        } else if (row.group === "dual-graph-shape") {
            const gate = atom(false)
            let dep = a
            const width = p.forwardSelectorLeaves ?? p.incomingWatchers
            if (p.forwardDepth)
                for (let i = 0; i < p.forwardDepth; i++) {
                    const old = dep
                    dep = selector(g => g(old) + 1)
                }
            else {
                const leaves = Array.from({ length: width }, () =>
                    selector(g => g(a)),
                )
                dep = selector(g => leaves.reduce((n, q) => n + g(q), 0))
            }
            const parent = selector(g => (g(gate) ? g(dep) : 0))
            selectors = p.incomingWatchers
                ? Array.from({ length: width }, () => selector(g => g(parent)))
                : [parent]
            for (const q of selectors) s.sub(q, () => {})
            for (let i = 0; i < 20; i++) s.set(gate, i % 2 === 0)
        } else if (row.group === "hydration") {
            const leaves = Array.from({ length: p.leaves }, (_, i) => atom(i))
            selectors = Array.from({ length: p.selectors }, (_, i) =>
                selector(g => g(leaves[i % leaves.length])),
            )
            for (const q of selectors) s.get(q)
            for (let i = 0; i < p.snapshots; i++)
                for (const q of selectors) adapter.readHydrationSnapshot(s, q)
        } else if (row.group === "scope-routing") {
            for (let i = 0; i < 1000; i++)
                s.scope("s" + i).get(selector(g => g(a) + 1))
            s.set(a, 1)
        } else if (row.group === "transaction-scratch") {
            const q = selector(g => g(a) + 1)
            s.txn(t => {
                t.set(a, 1)
                assert.equal(t.get(q), 2)
            })
        } else if (row.group === "subscription-lifecycle") {
            const shared = selector(g => g(a))
            selectors = Array.from({ length: 200 }, () =>
                selector(g => g(shared)),
            )
            const offs = selectors.map(q => s.sub(q, () => {}))
            offs.forEach(f => f())
        } else {
            selectors = Array.from({ length: p.selectors }, (_, i) =>
                selector(g => g(a) + i),
            )
            selectors.forEach(q => s.sub(q, () => {}))
            for (let i = 1; i <= 20; i++) s.set(a, i)
        }
        s.dispose()
        return { publicOnly: true, parameters: p }
    })
for (const row of m.memoryScenarios)
    probe([row.id], () => {
        const s = store()
        let count = row.units
        if (row.id === "M-ATOM-ONLY-STORES") {
            Array.from({ length: count }, (_, i) => atom(i)).forEach((a, i) =>
                s.set(a, i),
            )
        } else if (row.id === "M-SINGLE-STORE-TRANSACTIONS") {
            const atoms = Array.from({ length: count }, () => atom(0))
            s.txn(t => atoms.forEach((a, i) => t.set(a, i)))
        } else if (row.id === "M-SCOPE-CREATION-DISPOSAL") {
            const scopes = Array.from({ length: count }, (_, i) =>
                s.scope("s" + i),
            )
            scopes.forEach(x => x.dispose())
        } else if (row.id === "M-DEEP-CROSS-SCOPE-TRANSACTIONS") {
            let cursor = s
            for (let i = 1; i < count; i++) cursor = cursor.scope("d" + i)
            const atoms = Array.from({ length: count }, () => atom(0))
            function stage(t, i) {
                t.set(atoms[i], i + 1)
                if (i + 1 < count) t.scope("d" + (i + 1), c => stage(c, i + 1))
            }
            s.txn(t => stage(t, 0))
            cursor.sub(
                selector(g => atoms.reduce((n, a) => n + g(a), 0)),
                () => {},
            )
        } else {
            const gate = atom(true),
                a = atom(1),
                b = atom(2)
            const qs = Array.from({ length: count }, () =>
                selector(g =>
                    row.id === "M-DYNAMIC-DEPENDENCY-CHURN"
                        ? g(gate)
                            ? g(a)
                            : g(b)
                        : g(a),
                ),
            )
            qs.forEach(q => s.sub(q, () => {}))
            if (row.id === "M-DYNAMIC-DEPENDENCY-CHURN")
                for (let i = 0; i < 12; i++) s.set(gate, i % 2 === 0)
        }
        s.dispose()
        return {
            units: count,
            apiAdaptations:
                row.id === "M-SCOPE-CREATION-DISPOSAL"
                    ? ["dispose replaces legacy detach"]
                    : row.id === "M-ATOM-ONLY-STORES"
                      ? ["known initial value replaces legacy defaultValue"]
                      : [],
        }
    })
console.log(
    JSON.stringify(
        {
            kind: "admission-only",
            runtime: typeof Bun === "undefined" ? "node" : "bun",
            root,
            evidence,
        },
        null,
        2,
    ),
)
if (evidence.some(x => !x.executable)) process.exitCode = 1
