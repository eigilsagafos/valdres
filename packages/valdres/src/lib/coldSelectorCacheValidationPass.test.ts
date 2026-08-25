import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { getStoreData } from "./getStoreData"
import { measureArchitecture } from "../../test/utils/measureArchitecture"

/**
 * Cold-snapshot validation must cost O(edges) per read, not O(edges x fan-out).
 *
 * `validatedAt` is stamped from the tree-wide revision clock, and a validation
 * walk ADVANCES that clock every time it re-materializes a stale dependency. So
 * stamping alone made one re-evaluation age every sibling snapshot the same walk
 * had already validated, and each of those re-walked its whole closure. On a
 * demoted graph under write churn that is superlinear in graph size — a wide
 * shared selector graph spent all its time deciding whether cached values were
 * still valid and almost none producing them.
 *
 * `StoreTreeRuntime.coldValidationPass` is the fix: a generation that does NOT
 * move for the walk's own materializations, so a snapshot proven current is
 * visited once. These tests pin the bound and the invalidation that bounds it.
 */

/** atoms -> mids (each reads EVERY atom) -> tops (each reads EVERY mid) -> root.
 *  Every selector above the mid layer has selector dependencies, so validation
 *  takes the recursive path, and the mid layer is shared by every top — the
 *  shape whose repeated re-walking was the whole cost. */
const buildWideGraph = (
    atomCount: number,
    midCount: number,
    topCount: number,
) => {
    const atoms = Array.from({ length: atomCount }, () => atom(0))
    const mids = Array.from({ length: midCount }, (_, i) =>
        selector(get => {
            let sum = 0
            for (const a of atoms) sum += get(a)
            return sum + i
        }),
    )
    const tops = Array.from({ length: topCount }, (_, i) =>
        selector(get => {
            let sum = 0
            for (const m of mids) sum += get(m)
            return sum + i
        }),
    )
    const root = selector(get => {
        let sum = 0
        for (const t of tops) sum += get(t)
        return sum
    })
    /** What `root` must equal for the current atom values. */
    const expected = (values: number[]) => {
        const atomSum = values.reduce((a, b) => a + b, 0)
        let midSum = 0
        for (let i = 0; i < midCount; i++) midSum += atomSum + i
        let topSum = 0
        for (let i = 0; i < topCount; i++) topSum += midSum + i
        return topSum
    }
    /** Total dependency edges in root's closure. */
    const edges = atomCount * midCount + midCount * topCount + topCount
    return { atoms, mids, tops, root, expected, edges }
}

/** Subscribe, then unsubscribe, so cleanupOrphanedDeps demotes the whole
 *  closure into cold snapshots rather than dropping their values. */
const demote = (target: ReturnType<typeof store>, root: any) => {
    const unsubscribe = target.sub(root, () => {})
    target.get(root)
    unsubscribe()
    // Flush the queued orphan cleanup.
    target.get(root)
}

describe("cold selector cache validation pass", () => {
    test("validating a wide shared cold graph stays within one pass over its edges", () => {
        const graph = buildWideGraph(10, 12, 4)
        const target = store()
        demote(target, graph.root)
        expect(
            getStoreData(target).coldSelectorCaches.has(graph.mids[0]!),
        ).toBe(true)

        // Write one tracked atom, then read the root. Every snapshot in the
        // closure is stale, so all of them get walked exactly once.
        const first = measureArchitecture(target, () => {
            target.set(graph.atoms[0]!, 1)
            expect(target.get(graph.root)).toBe(
                graph.expected([1, ...Array(9).fill(0)]),
            )
        })

        // The bound that matters: proportional to the edge count, NOT to edges
        // x dependents-per-shared-node. Before the pass every one of the 12 mids
        // re-walked its 10 atoms once per top that reached it, and again after
        // each sibling re-evaluation aged its stamp.
        expect(graph.edges).toBe(172)
        expect(first.coldCacheDependencyChecks).toBeLessThanOrEqual(graph.edges)

        // A second read with nothing changed in between costs nothing at all:
        // the pass that the first read opened is still authoritative, so no
        // snapshot is re-walked even though the first read's re-evaluations
        // left every `validatedAt` behind the clock.
        const second = measureArchitecture(target, () => {
            expect(target.get(graph.root)).toBe(
                graph.expected([1, ...Array(9).fill(0)]),
            )
        })
        expect(second.coldCacheDependencyChecks).toBe(0)
        expect(second.selectorEvaluations).toBe(0)
    })

    test("the per-read bound does not grow with dependents per shared node", () => {
        // The multiplier that regressed is how many DEPENDENTS each shared node
        // has, not how wide the shared layer is: a mid was re-walked once per
        // top that reached it, and again after each sibling re-evaluation aged
        // its stamp. So vary `topCount` and hold `midCount` fixed. (Varying
        // `midCount` instead leaves the ratio flat — measured 2.88 -> 2.97 with
        // the memo disabled — so that arrangement asserts nothing.)
        const measure = (topCount: number) => {
            const graph = buildWideGraph(8, 12, topCount)
            const target = store()
            demote(target, graph.root)
            const counts = measureArchitecture(target, () => {
                target.set(graph.atoms[0]!, 1)
                target.get(graph.root)
            })
            return counts.coldCacheDependencyChecks / graph.edges
        }
        // Measured with the memo disabled: 1.79 at 2 dependents rising to 5.74
        // at 16, i.e. the ratio tracks the multiplier directly. With the memo it
        // is 1.00 throughout, so 1.5x is a wide margin that still fails on any
        // return to per-dependent re-walking.
        const few = measure(2)
        const many = measure(16)
        expect(many).toBeLessThanOrEqual(few * 1.5)
    })

    test("a write after the pass ends still invalidates every snapshot", () => {
        const graph = buildWideGraph(4, 3, 2)
        const target = store()
        demote(target, graph.root)

        target.set(graph.atoms[0]!, 1)
        expect(target.get(graph.root)).toBe(graph.expected([1, 0, 0, 0]))
        // Second write lands after the first read's pass closed. If the pass
        // survived it, this would serve the previous value.
        target.set(graph.atoms[1]!, 10)
        expect(target.get(graph.root)).toBe(graph.expected([1, 10, 0, 0]))
        target.set(graph.atoms[0]!, 100)
        expect(target.get(graph.root)).toBe(graph.expected([100, 10, 0, 0]))
    })

    test("interleaved writes and reads on a demoted graph stay correct", () => {
        const graph = buildWideGraph(5, 4, 3)
        const target = store()
        demote(target, graph.root)

        const values = [0, 0, 0, 0, 0]
        for (let i = 0; i < 40; i++) {
            const index = i % values.length
            values[index] = i + 1
            target.set(graph.atoms[index]!, i + 1)
            expect(target.get(graph.root)).toBe(graph.expected(values))
            // A repeated read inside the same (unchanged) pass must agree.
            expect(target.get(graph.root)).toBe(graph.expected(values))
        }
    })

    test("a scope-local write invalidates the pass for the reading scope", () => {
        const source = atom(1)
        const mid = selector(get => get(source) * 2)
        const root = selector(get => get(mid) + 1)
        const rootStore = store()
        const scope = rootStore.scope("s")

        demote(scope, root)
        expect(scope.get(root)).toBe(3)

        // Shadow the atom in the scope only. The parent's value is untouched.
        scope.set(source, 5)
        expect(scope.get(root)).toBe(11)
        expect(rootStore.get(root)).toBe(3)

        // ...and a parent write must not leak past the scope's shadow.
        rootStore.set(source, 9)
        expect(scope.get(root)).toBe(11)
        expect(rootStore.get(root)).toBe(19)

        // Dropping the shadow re-inherits the parent's current value.
        scope.unset(source)
        expect(scope.get(root)).toBe(19)
    })

    test("a late async dependency is not memoed away by the pass", async () => {
        const gate = atom(1)
        const late = atom(100)
        let evaluations = 0
        // `late` is read only after the promise resolves, so its edge arrives
        // through installLateDependency — which invalidates the cold snapshot
        // (validatedAt = -1) in a microtask, without necessarily moving the
        // clock. The pass must not resurrect the retired snapshot.
        const source = selector((get: any) => {
            evaluations++
            const base = get(gate)
            return Promise.resolve().then(() => base + get(late))
        })
        const target = store()

        expect(await target.get(source)).toBe(101)
        expect(target.get(source)).toBe(101)
        expect(evaluations).toBe(1)

        target.set(late, 200)
        expect(await target.get(source)).toBe(201)
        expect(evaluations).toBe(2)

        // And a read burst after the invalidation settles still agrees.
        expect(target.get(source)).toBe(201)
        expect(target.get(source)).toBe(201)
        expect(evaluations).toBe(2)
    })

    test("a write from inside a selector body ends the pass", () => {
        // The one way the pass's premise can be violated: user code re-enters
        // the store and WRITES while the validation walk is running, so the
        // clock moves for a reason the walk did not derive. `shared` is read by
        // a snapshot the walk validates before `saboteur` runs, so a surviving
        // pass would keep serving that snapshot's pre-write value.
        const trigger = atom(0)
        const shared = atom(1)
        const target = store()

        const observer = selector(get => get(shared) * 10)
        const saboteur = selector(get => {
            const t = get(trigger)
            if (t === 1) target.set(shared, 7)
            return t
        })
        // `observer` is validated first, then `saboteur` writes `shared`.
        const root = selector(get => get(observer) + get(saboteur))

        expect(target.get(root)).toBe(10)
        target.set(trigger, 1)
        // saboteur's write makes shared === 7, so observer must be 70.
        expect(target.get(root)).toBe(71)
        // ...and it must stay agreed on afterwards.
        expect(target.get(observer)).toBe(70)
        expect(target.get(root)).toBe(71)
    })

    test("an EQUAL-result re-entrant write still invalidates the parent", () => {
        // The sibling test above returns `t`, which changes the saboteur's own
        // value and so bumps its revision — that alone invalidates `root`
        // through the ordinary revision path and MASKS this defect. Return a
        // constant instead and the saboteur's revision never moves, so the only
        // thing that can invalidate `root` is the pass machinery.
        //
        // The failure it exposed: the write retires the pass MID-WALK, and
        // `root` then stamps itself into the NEW pass id using the dependency
        // revisions it read BEFORE the write. `observer` later repairs to 70,
        // but `root` is stamped in the current pass, so the store serves
        // root === 10 and observer === 70 at the same time, forever — even
        // though root's body is `observer + saboteur` === 70.
        let target: any
        const trigger = atom(0)
        const shared = atom(1)
        const observer = selector(get => get(shared) * 10)
        const saboteur = selector(get => {
            const t = get(trigger)
            if (t === 1) target.set(shared, 7)
            return 0 // deliberately unchanged
        })
        const root = selector(get => get(observer) + get(saboteur))
        target = store()

        expect(target.get(root)).toBe(10)
        target.set(trigger, 1)
        // Whatever the first post-write read returns, the store must not go on
        // serving a root that contradicts the observer it is built from.
        target.get(root)
        expect(target.get(observer)).toBe(70)
        expect(target.get(root)).toBe(70)
        expect(target.get(root)).toBe(70)
    })

    test("a lazily resolved atom default ends the pass", () => {
        // A default resolving for the first time is a source change the walk did
        // not derive: a snapshot may have recorded revision 0 for the atom while
        // it was still unmaterialized.
        let resolved = 0
        const lazy = atom(() => {
            resolved++
            return 5
        })
        const gate = atom(0)
        const target = store()
        const derived = selector(get => get(lazy) + get(gate))

        expect(target.get(derived)).toBe(5)
        expect(resolved).toBe(1)

        target.unset(lazy)
        target.set(gate, 1)
        expect(target.get(derived)).toBe(6)
        expect(resolved).toBe(2)
        expect(target.get(derived)).toBe(6)
    })

    test("a dynamically cyclic cold graph keeps reporting the cycle", () => {
        // Stability is NOT the bar here — a latched snapshot is stable and wrong.
        // What must hold is that the cycle keeps surfacing rather than going
        // quiet behind a memo. (The semantic half is asserted by "a dynamic cycle
        // never settles on a semantically impossible state" below.)
        const seed = atom(1)
        const flip = atom(0)
        let mid: any
        let top: any
        // Warm while ACYCLIC, then flip `bottom` onto a branch that reads its own
        // dependents, closing the cycle after the snapshots already exist.
        const bottom: any = selector(get =>
            get(flip) % 2 === 0
                ? 100000 + get(seed)
                : 100000 + get(top) + get(mid),
        )
        mid = selector(get => 300000 + get(bottom))
        top = selector(get => 500000 + get(mid))

        const target = store()
        expect(target.get(mid)).toBe(400001)
        expect(target.get(top)).toBe(900001)
        expect(target.get(bottom)).toBe(100001)

        target.set(flip, 1)
        for (let round = 0; round < 5; round++) {
            for (const state of [bottom, mid, top]) {
                expect(() => target.get(state)).toThrow(
                    SelectorCircularDependencyError,
                )
            }
        }
    })

    test("a statically cyclic cold graph throws on every read", () => {
        let second: any
        const first: any = selector(get => 1 + get(second))
        second = selector(get => 2 + get(first))
        const target = store()
        for (const state of [first, second, first]) {
            expect(() => target.get(state)).toThrow(
                SelectorCircularDependencyError,
            )
        }
    })

    test("a dynamic cycle never settles on a semantically impossible state", () => {
        // The bar for a cyclic cold read is NOT stability — a latched state is
        // stable and wrong. Every value the store serves must agree with its own
        // body over the values that same store serves, or the read must throw
        // the documented cycle error.
        //
        // The failure this exposed: with `flip` truthy, A's body is `B + 1`, so
        // A === 5 while B === 6 is impossible. It was reached because the cycle
        // guard's guess escaped the read through `validatedAt` (retiring only the
        // pass id is not enough), and repeated reads then served it forever.
        const flip = atom(0)
        const seed = atom(1)
        let second: any
        const first: any = selector(get =>
            get(flip) ? (get(second) as number) + 1 : get(seed),
        )
        second = selector(get => (get(first) as number) + 1)
        const target = store()

        expect(target.get(first)).toBe(1)
        expect(target.get(second)).toBe(2)
        target.set(flip, 1)

        for (let round = 0; round < 4; round++) {
            let a: number | null = null
            let b: number | null = null
            try {
                a = target.get(first) as number
            } catch (error) {
                expect(error).toBeInstanceOf(SelectorCircularDependencyError)
            }
            try {
                b = target.get(second) as number
            } catch (error) {
                expect(error).toBeInstanceOf(SelectorCircularDependencyError)
            }
            // Semantic oracle: any value actually served must satisfy its body.
            if (a !== null && b !== null) {
                expect(a).toBe(b + 1) // first's body, with flip truthy
                expect(b).toBe(a + 1) // second's body
            }
        }
    })

    test("an async settlement never stamps the pass from outside a walk", async () => {
        // A settlement lands in a microtask, where no validation walk is in
        // flight and therefore nothing has proven the snapshot's closure — yet
        // the pass it would name is very often still authoritative, which made
        // the snapshot permanently un-invalidatable. Only `validatedAt` may be
        // recorded there.
        const source = atom(1)
        const settling = selector((get: any) =>
            Promise.resolve().then(() => get(source) * 10),
        )
        const target = store()
        const tree = getStoreData(target).tree

        expect(await target.get(settling)).toBe(10)
        const cache = getStoreData(target).coldSelectorCaches.get(settling)!
        expect(cache.validatedInPass).toBe(0)
        expect(cache.validatedAt).toBe(tree.revision)

        // The write must still get through to the settled snapshot.
        target.set(source, 3)
        expect(await target.get(settling)).toBe(30)
        target.set(source, 7)
        expect(await target.get(settling)).toBe(70)
    })

    test("a late async dependency retires the pass for its dependents too", async () => {
        // installLateDependency retires the snapshot whose dependency list
        // outgrew its revision array. Before the pass memo an ANCESTOR
        // revalidating always re-read every selector dependency and so pulled
        // that repair through; a stamped ancestor skips the loop entirely.
        const early = atom(1)
        const lateRead = atom(100)
        const late = selector((get: any) => {
            const base = get(early)
            return Promise.resolve().then(() => base + get(lateRead))
        })
        const dependent = selector((get: any) => get(late))
        const target = store()

        expect(await target.get(dependent)).toBe(101)
        target.set(lateRead, 200)
        expect(await target.get(dependent)).toBe(201)
        target.set(early, 5)
        expect(await target.get(dependent)).toBe(205)
    })

    test("pass state is only touched once a cold snapshot exists", () => {
        const source = atom(1)
        const derived = selector(get => get(source) + 1)
        const target = store()
        const tree = getStoreData(target).tree

        // A live graph never validates a cold snapshot, so the pass counters
        // stay exactly where construction left them.
        const unsubscribe = target.sub(derived, () => {})
        target.set(source, 2)
        expect(target.get(derived)).toBe(3)
        expect(tree.coldValidationDepth).toBe(0)
        expect(tree.coldValidationPass).toBe(1)
        expect(tree.coldValidationBaseRevision).toBe(-1)
        unsubscribe()
    })
})
