import { describe, expect, test } from "bun:test"
import {
    createCommittedStoreTreeDomain,
    createInternalExternalAtom,
    createInternalStoreTreeInstrumentation,
    RuntimeMismatchError,
    SubscriberNotificationError,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    DormantExternalReadError,
    ExternalSourceOperationError,
} from "../../src/v1-internal/committed-store-tree/external-atom"
import { ExternalReferenceModel } from "../v1-model/external-model"
import { value as token } from "../v1-model/protocol"

function setup() {
    const counters = createInternalStoreTreeInstrumentation()
    const domain = createCommittedStoreTreeDomain(counters)
    const store = domain.createStoreTree()
    let value = 0
    let samples = 0
    let subscriptions = 0
    const ext = createInternalExternalAtom(domain, {
        getSnapshot() {
            samples++
            return value
        },
        subscribe() {
            subscriptions++
            return () => {}
        },
    })
    return {
        domain,
        store,
        ext,
        counters,
        write(next: number) {
            value = next
        },
        samples: () => samples,
        subscriptions: () => subscriptions,
    }
}

describe("internal external pull", () => {
    test("a dynamically discovered control fault evaluates each failed selector only once per pull", () => {
        const f = setup(),
            foreign = createCommittedStoreTreeDomain()
        const alien = foreign.atom(0)
        let fail = true,
            samples = 0,
            runs = 0
        const B = createInternalExternalAtom(f.domain, {
            getSnapshot() {
                samples++
                if (fail) f.store.get(alien)
                return 7
            },
            subscribe: () => () => {},
        })
        const S = f.domain.selector(get => {
            runs++
            return get(f.ext) ? get(B) : 0
        })
        expect(f.store.get(S)).toBe(0)
        f.write(1)
        expect(() => f.store.get(S)).toThrow(RuntimeMismatchError)
        expect([runs, samples]).toEqual([2, 1])
        fail = false
        expect(f.store.get(S)).toBe(7)
        expect([runs, samples]).toEqual([3, 2])
    })

    test.each([false, true])(
        "a later control fault still settles earlier publications and preserves callback failures (callback=%s)",
        callbackFails => {
            const f = setup(),
                foreign = createCommittedStoreTreeDomain()
            const alien = foreign.atom(0)
            let fail = false,
                samples = 0,
                calls = 0
            const callbackError = new Error("callback")
            let mismatch: unknown
            const B = createInternalExternalAtom(f.domain, {
                getSnapshot() {
                    samples++
                    if (fail) {
                        try {
                            f.store.get(alien)
                        } catch (error) {
                            mismatch = error
                            throw error
                        }
                    }
                    return 1
                },
                subscribe: () => () => {},
            })
            const C = f.domain.selector(get => get(f.ext))
            const S = f.domain.selector(get => get(f.ext) + get(B))
            f.store.get(C)
            f.store.get(S)
            f.store.sub(C, () => {
                calls++
                if (callbackFails) throw callbackError
            })
            f.write(2)
            fail = true
            const before = samples
            let error: unknown
            try {
                f.store.get(S)
            } catch (caught) {
                error = caught
            }
            expect(samples).toBe(before + 1)
            expect(calls).toBe(1)
            if (callbackFails) {
                expect(error).toBeInstanceOf(ExternalSourceOperationError)
                expect((error as ExternalSourceOperationError).causes).toEqual([
                    mismatch,
                    callbackError,
                ])
                expect(
                    (error as ExternalSourceOperationError).failures.map(
                        failure => [failure.phase, failure.committed],
                    ),
                ).toEqual([
                    ["sampling", true],
                    ["notifying", true],
                ])
            } else expect(error).toBe(mismatch)
            fail = false
            expect(f.store.get(C)).toBe(2)
            expect(f.store.get(S)).toBe(3)
            expect(calls).toBe(1)
        },
    )

    test("deep equal-valued closure changes and unchanged refresh do not consume the JS stack", () => {
        const domain = createCommittedStoreTreeDomain(),
            store = domain.createStoreTree()
        const gate = domain.atom(false)
        let external!: ReturnType<typeof createInternalExternalAtom<number>>
        let current = domain.selector(get => (get(gate) ? get(external) : 0))
        store.get(current)
        let evaluations = 0
        for (let index = 0; index < 16000; index++) {
            const previous = current
            current = domain.selector(get => {
                evaluations++
                return get(previous)
            })
            store.get(current)
        }
        external = createInternalExternalAtom(domain, {
            getSnapshot: () => 0,
            subscribe: () => () => {},
        })
        expect(() => store.set(gate, true)).not.toThrow()
        expect(store.get(current)).toBe(0)
        expect(evaluations).toBe(16000)
    }, 30000)

    test("seeded cross-scope dynamic reads agree with the independent external oracle", () => {
        for (let seed = 1; seed <= 16; seed++) {
            let random = seed
            const next = () =>
                (random = (Math.imul(random, 1664525) + 1013904223) >>> 0)
            const numbers = [1, 2, 3]
            const domain = createCommittedStoreTreeDomain()
            const root = domain.createStoreTree()
            const scopes = [root, root.scope(), root.scope()]
            const externals = numbers.map((_, index) =>
                createInternalExternalAtom(domain, {
                    getSnapshot: () => numbers[index]!,
                    subscribe: () => () => {},
                }),
            )
            const branch = domain.selector(get =>
                get(externals[0]!) ? get(externals[1]!) : get(externals[2]!),
            )
            const states = [...externals, branch]
            const ids = ["a", "b", "c", "branch"]
            const oracle = new ExternalReferenceModel(
                numbers.map((number, index) => ({
                    id: ids[index]!,
                    snapshot: { kind: "value", value: token.number(number) },
                })),
                [
                    ...ids.slice(0, 3).map(id => ({
                        kind: "external" as const,
                        id,
                        source: id,
                    })),
                    {
                        kind: "selector",
                        id: "branch",
                        expression: {
                            kind: "choose",
                            condition: "a",
                            yes: "b",
                            no: "c",
                        },
                    },
                ],
            )
            oracle.execute({ kind: "tree", tree: "tree", root: "root" })
            oracle.execute({
                kind: "scope",
                tree: "tree",
                parent: "root",
                scope: "left",
            })
            oracle.execute({
                kind: "scope",
                tree: "tree",
                parent: "root",
                scope: "right",
            })
            for (let step = 0; step < 200; step++) {
                const index = next() % 3
                numbers[index] = next() % 5
                oracle.execute({
                    kind: "write",
                    source: ids[index]!,
                    snapshot: {
                        kind: "value",
                        value: token.number(numbers[index]!),
                    },
                })
                const scope = next() % 3,
                    target = next() % 4
                const outcome = oracle.execute({
                    kind: "read",
                    tree: "tree",
                    scope: ["root", "left", "right"][scope]!,
                    node: ids[target]!,
                }).outcome
                expect(outcome).toEqual({
                    kind: "value",
                    value: token.number(scopes[scope]!.get(states[target]!)),
                })
            }
        }
    })

    test("one dormant sample per read, unchanged sample evaluates no selectors", () => {
        const f = setup()
        let runs = 0
        const double = f.domain.selector(get => {
            runs++
            return get(f.ext) + get(f.ext)
        })
        expect(f.store.get(double)).toBe(0)
        expect(f.samples()).toBe(1)
        expect(runs).toBe(1)
        expect(f.store.get(double)).toBe(0)
        expect(f.samples()).toBe(2)
        expect(runs).toBe(1)
        f.write(2)
        expect(f.store.get(double)).toBe(4)
        expect(f.samples()).toBe(3)
        expect(runs).toBe(2)
        expect(f.subscriptions()).toBe(0)
    })

    test("changed diamond settles each affected selector once", () => {
        const f = setup()
        const runs = [0, 0, 0]
        const left = f.domain.selector(get => {
            runs[0]!++
            return get(f.ext) + 1
        })
        const right = f.domain.selector(get => {
            runs[1]!++
            return get(f.ext) + 2
        })
        const sum = f.domain.selector(get => {
            runs[2]!++
            return get(left) + get(right)
        })
        expect(f.store.get(sum)).toBe(3)
        f.write(5)
        expect(f.store.get(sum)).toBe(13)
        expect(runs).toEqual([2, 2, 2])
        expect(f.samples()).toBe(2)
    })

    test("sibling scopes share outcome while retaining their own selector DAG", () => {
        const f = setup()
        const left = f.store.scope(),
            right = f.store.scope()
        let runs = 0
        const selected = f.domain.selector(get => {
            runs++
            return get(f.ext)
        })
        left.get(selected)
        right.get(selected)
        expect(runs).toBe(2)
        f.write(7)
        expect(left.get(selected)).toBe(7)
        expect(runs).toBe(4)
        const sampled = f.samples()
        expect(right.get(selected)).toBe(7)
        expect(f.samples()).toBe(sampled + 1)
        expect(runs).toBe(4)
    })

    test("a dynamically selected cached branch refreshes its dormant source", () => {
        const f = setup()
        let pick = true,
            rightValue = 10
        const choose = createInternalExternalAtom(f.domain, {
            getSnapshot: () => pick,
            subscribe: () => () => {},
        })
        const rightSource = createInternalExternalAtom(f.domain, {
            getSnapshot: () => rightValue,
            subscribe: () => () => {},
        })
        const cachedRight = f.domain.selector(get => get(rightSource))
        const selected = f.domain.selector(get =>
            get(choose) ? get(f.ext) : get(cachedRight),
        )
        expect(f.store.get(cachedRight)).toBe(10)
        expect(f.store.get(selected)).toBe(0)
        pick = false
        rightValue = 20
        expect(f.store.get(selected)).toBe(20)
        expect(f.store.get(cachedRight)).toBe(20)
    })

    test("late dynamic dirtiness reopens clean administrative dependency visits", () => {
        const f = setup()
        let a = true,
            b = 10
        const A = createInternalExternalAtom(f.domain, {
            getSnapshot: () => a,
            subscribe: () => () => {},
        })
        const B = createInternalExternalAtom(f.domain, {
            getSnapshot: () => b,
            subscribe: () => () => {},
        })
        let vRuns = 0
        const V = f.domain.selector(get => {
            vRuns++
            return get(B)
        })
        const U = f.domain.selector(get => get(B))
        const D = f.domain.selector(get => (get(A) ? get(V) : 0))
        const T = f.domain.selector(get => (get(A) ? 1 : get(U)))
        f.store.get(D)
        f.store.get(T)
        a = false
        b = 20
        expect(f.store.get(T)).toBe(20)
        expect(vRuns).toBe(2)
        expect(f.store.get(V)).toBe(20)
        expect(vRuns).toBe(2)
    })

    test("equal-valued topology changes refresh sparse closure markers through ancestors", () => {
        const f = setup()
        const toggle = f.domain.atom(false)
        const dynamic = f.domain.selector(get => (get(toggle) ? get(f.ext) : 0))
        let outerRuns = 0
        const outer = f.domain.selector(get => {
            outerRuns++
            return get(dynamic)
        })
        expect(f.store.get(outer)).toBe(0)
        f.store.set(toggle, true)
        expect(outerRuns).toBe(1)
        f.write(3)
        expect(f.store.get(outer)).toBe(3)
        expect(outerRuns).toBe(2)
        f.store.set(toggle, false)
        const count = f.samples()
        f.store.get(outer)
        expect(f.samples()).toBe(count)
    })

    test("external-free reads and writes do zero sampling or closure work", () => {
        const f = setup()
        f.store.get(f.domain.selector(get => get(f.ext)))
        const atom = f.domain.atom(0),
            selector = f.domain.selector(get => get(atom))
        const samples = f.samples(),
            visits = f.counters.read("externalClosureVisits")
        f.store.get(selector)
        const unsub = f.store.sub(selector, () => {})
        f.store.set(atom, 1)
        f.store.txn(tx => {
            tx.get(selector)
            tx.set(atom, 2)
        })
        unsub()
        expect(f.samples()).toBe(samples)
        expect(f.counters.read("externalClosureVisits")).toBe(visits)
    })

    test("dormant mismatch publishes no projection and cannot be caught into selector success", () => {
        const f = setup(),
            foreign = createCommittedStoreTreeDomain()
        const other = foreign.atom(1)
        const ext = createInternalExternalAtom(f.domain, {
            getSnapshot() {
                try {
                    f.store.get(other)
                } catch {}
                return 1
            },
            subscribe: () => () => {},
        })
        const selected = f.domain.selector(get => {
            try {
                return get(ext)
            } catch {
                return 2
            }
        })
        expect(() => f.store.get(selected)).toThrow(RuntimeMismatchError)
        expect(f.counters.read("projectionPublications")).toBe(0)
        expect(f.counters.read("sourceEpoch")).toBe(0)
    })

    test.each([false, true])(
        "subscriber cannot catch dormant reads into a published selector (cached=%s)",
        cached => {
            const f = setup()
            let runs = 0
            const selected = f.domain.selector(get => {
                runs++
                try {
                    return get(f.ext)
                } catch {
                    return 99
                }
            })
            if (cached) f.store.get(selected)
            const atom = f.domain.atom(0)
            f.store.sub(atom, () => {
                try {
                    f.store.get(selected)
                } catch {}
            })
            const before = f.samples()
            let failure: unknown
            try {
                f.store.set(atom, 1)
            } catch (error) {
                failure = error
            }
            expect(failure).toBeInstanceOf(SubscriberNotificationError)
            expect(
                (failure as SubscriberNotificationError).cause,
            ).toBeInstanceOf(DormantExternalReadError)
            expect(f.samples()).toBe(before)
            expect(f.store.get(selected)).toBe(0)
            expect(runs).toBe(cached ? 1 : 2)
        },
    )
})
