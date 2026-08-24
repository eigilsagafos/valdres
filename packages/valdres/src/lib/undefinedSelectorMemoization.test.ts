import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { selectorFamily } from "../selectorFamily"
import { store } from "../store"
import type { Atom } from "../types/Atom"
import { getStoreData } from "./getStoreData"

// Regression for the beta.20 "selector re-evaluates on every dependency read"
// memoization loss.
//
// `initSelector` compared the freshly computed value against
// `data.values.get(selector)` and skipped `setValueInData` when `equal`
// reported no change. For a FIRST evaluation there is no entry, so
// `existingValue` was the absent-value sentinel `undefined` — meaning any
// selector that computes `undefined` (and any selector with a custom `equal`
// that accepts `undefined`) compared equal to nothing at all and was never
// written into the store.
//
// Every cache hit downstream keys off `data.values.has(state)`
// (`getState`, the dependency getter in `evaluateSelector` /
// `evaluateLiveOnlySelector`, `getDefault`), so an unwritten selector was
// permanently unmemoized: each `get()` re-ran the body. Repeated reads of the
// same member inside ONE parent evaluation — the shape a recursive graph
// traversal produces — turned into O(reads x full re-eval), and the cost
// multiplies at every level of a chain (10 reads x 3 levels = 100 leaf
// evaluations instead of 1).
//
// 0.2.0-alpha.28 always did `data.values.set(selector, value)` in
// `initSelector`, which is why the same app flow evaluated the leaf a handful
// of times there and ~467k times on beta.20.
//
// The fix distinguishes "absent" from "present and undefined" before trusting
// `equal`. These tests count factory invocations, so they fail loudly if the
// write is ever skipped for a first materialization again.

/** A selector returning `value`, paired with a live count of how many times its
 *  body has run. The counter lives in the fixture (not the engine's
 *  instrumentation) so a failure points at THIS selector; the matrix gate in
 *  selectorMemoizationGate.test.ts counts engine-wide instead. */
const countingSelector = <V>(name: string, value: V, dep: Atom<unknown>) => {
    const counter = { evaluations: 0 }
    const state = selector<V>(
        get => {
            counter.evaluations++
            get(dep)
            return value
        },
        { name },
    )
    return [state, counter] as const
}

describe("undefined-valued selectors are memoized", () => {
    test("repeated reads inside ONE parent evaluation evaluate the child once", () => {
        const source = atom(1, { name: "um-source-1" })
        const [child, counter] = countingSelector(
            "um-child-1",
            undefined,
            source,
        )
        const parent = selector(
            get => {
                let reads = 0
                for (let i = 0; i < 25; i++) {
                    if (get(child) === undefined) reads++
                }
                return reads
            },
            { name: "um-parent-1" },
        )

        const testStore = store()
        expect(testStore.get(parent)).toBe(25)
        // Was 25 before the fix — one full re-evaluation per `get(child)`.
        expect(counter.evaluations).toBe(1)
    })

    test("the same holds when the parent is subscribed (live reverse graph)", () => {
        const source = atom(1, { name: "um-source-2" })
        const [child, counter] = countingSelector(
            "um-child-2",
            undefined,
            source,
        )
        const parent = selector(
            get => {
                let reads = 0
                for (let i = 0; i < 25; i++) {
                    if (get(child) === undefined) reads++
                }
                return reads
            },
            { name: "um-parent-2" },
        )

        const testStore = store()
        testStore.sub(parent, () => {})
        expect(counter.evaluations).toBe(1)

        // A write still re-evaluates exactly once, not once per read.
        testStore.set(source, 2)
        expect(counter.evaluations).toBe(2)
    })

    test("the same holds inside a scope", () => {
        const source = atom(1, { name: "um-source-3" })
        const [child, counter] = countingSelector(
            "um-child-3",
            undefined,
            source,
        )
        const parent = selector(
            get => {
                let reads = 0
                for (let i = 0; i < 25; i++) {
                    if (get(child) === undefined) reads++
                }
                return reads
            },
            { name: "um-parent-3" },
        )

        const testStore = store()
        const scoped = testStore.scope("um-scope")
        expect(scoped.get(parent)).toBe(25)
        expect(counter.evaluations).toBe(1)
    })

    test("selectorFamily members are memoized per member", () => {
        // The reported shape: a trivial leaf family member read many times by
        // a traversal — `selectorFamily(ref => get => get(entity(ref)).data.x)`
        // where `x` is absent on the entity.
        let evaluations = 0
        const entity = atomFamily<{ data: { duration?: number } }, [string]>(
            () => ({ data: {} }),
            { name: "um-entity" },
        )
        const duration = selectorFamily<number | undefined, [string]>(
            (ref: string) => get => {
                evaluations++
                return get(entity(ref)).data.duration
            },
            { name: "um-duration" },
        )
        const refs = ["a", "b", "c", "d"]
        const total = selector(
            get => {
                let sum = 0
                for (let i = 0; i < 25; i++) {
                    for (const ref of refs) sum += get(duration(ref)) ?? 0
                }
                return sum
            },
            { name: "um-total" },
        )

        const testStore = store()
        expect(testStore.get(total)).toBe(0)
        // Was refs.length * 25 === 100 before the fix.
        expect(evaluations).toBe(refs.length)
    })

    test("a scoped selectorFamily traversal evaluates each member once", () => {
        let evaluations = 0
        const entity = atomFamily<{ duration?: number }, [string]>(() => ({}), {
            name: "um-scoped-entity",
        })
        const duration = selectorFamily<number | undefined, [string]>(
            (ref: string) => get => {
                evaluations++
                return get(entity(ref)).duration
            },
            { name: "um-scoped-duration" },
        )
        const refs = ["a", "b", "c"]
        const total = selector(
            get => {
                let sum = 0
                for (let i = 0; i < 20; i++) {
                    for (const ref of refs) sum += get(duration(ref)) ?? 0
                }
                return sum
            },
            { name: "um-scoped-total" },
        )

        const scoped = store().scope("um-scoped")
        scoped.sub(total, () => {})
        expect(evaluations).toBe(refs.length)
    })

    test("the cost does not multiply down a chain of undefined selectors", () => {
        const source = atom(1, { name: "um-source-4" })
        const counts = { leaf: 0, middle: 0, top: 0 }
        const leaf = selector(
            get => {
                counts.leaf++
                get(source)
                return undefined
            },
            { name: "um-leaf-4" },
        )
        const middle = selector(
            get => {
                counts.middle++
                for (let i = 0; i < 10; i++) get(leaf)
                return undefined
            },
            { name: "um-middle-4" },
        )
        const top = selector(
            get => {
                counts.top++
                for (let i = 0; i < 10; i++) get(middle)
                return 1
            },
            { name: "um-top-4" },
        )

        const testStore = store()
        expect(testStore.get(top)).toBe(1)
        // Was { leaf: 100, middle: 10, top: 1 } before the fix.
        expect(counts).toEqual({ leaf: 1, middle: 1, top: 1 })
    })

    test("repeated top-level get() of an undefined selector evaluates once", () => {
        const source = atom(1, { name: "um-source-5" })
        const [state, counter] = countingSelector(
            "um-child-5",
            undefined,
            source,
        )

        const testStore = store()
        // Pre-initialize the atom so nothing is lazily initialized by the read
        // below — that is what used to bypass getDefault's read-target
        // restore-the-value fallback and re-evaluate on every get.
        testStore.get(source)
        for (let i = 0; i < 10; i++)
            expect(testStore.get(state)).toBeUndefined()
        expect(counter.evaluations).toBe(1)
    })

    test("a selector with no dependencies at all is memoized", () => {
        let evaluations = 0
        const state = selector(
            () => {
                evaluations++
                return undefined
            },
            { name: "um-no-deps" },
        )
        const testStore = store()
        for (let i = 0; i < 10; i++) testStore.get(state)
        expect(evaluations).toBe(1)
    })

    test("a custom equal that accepts undefined does not disable memoization", () => {
        // `equal: () => true` reported the first value equal to the absent
        // entry too, so this shape lost memoization even for defined values.
        const source = atom(1, { name: "um-source-6" })
        let evaluations = 0
        const child = selector(
            get => {
                evaluations++
                return get(source)
            },
            { name: "um-child-6", equal: () => true },
        )
        const parent = selector(
            get => {
                let sum = 0
                for (let i = 0; i < 25; i++) sum += get(child)
                return sum
            },
            { name: "um-parent-6" },
        )

        const testStore = store()
        expect(testStore.get(parent)).toBe(25)
        expect(evaluations).toBe(1)
    })

    test("an undefined value is committed, not just skipped", () => {
        // Same invariant stated directly: after a read, the store holds an
        // entry for the selector. Everything above is downstream of this.
        // Assert it for a TRANSITIVELY read selector — `getDefault` has a
        // separate restore-the-read-target fallback (added for React
        // getSnapshot reference stability) that masked the missing write for
        // the directly-read state only.
        const source = atom(1, { name: "um-source-7" })
        const child = selector(
            get => {
                get(source)
                return undefined
            },
            { name: "um-child-7" },
        )
        const parent = selector(get => get(child) === undefined, {
            name: "um-parent-7",
        })
        const testStore = store()
        testStore.get(parent)
        expect(getStoreData(testStore).values.has(child)).toBe(true)
    })

    test("undefined stays observable through writes and reverts", () => {
        // Guard the correctness side: memoizing `undefined` must not swallow
        // transitions in either direction.
        const source = atom<number>(1, { name: "um-source-8" })
        const child = selector<number | undefined>(
            get => (get(source) === 1 ? undefined : get(source)),
            { name: "um-child-8" },
        )
        const parent = selector(get => `v=${get(child)}`, {
            name: "um-parent-8",
        })

        const testStore = store()
        const seen: string[] = []
        testStore.sub(parent, () => seen.push(testStore.get(parent)))

        expect(testStore.get(parent)).toBe("v=undefined")
        testStore.set(source, 2)
        expect(testStore.get(parent)).toBe("v=2")
        testStore.set(source, 1)
        expect(testStore.get(parent)).toBe("v=undefined")
        expect(seen).toEqual(["v=2", "v=undefined"])
    })

    test("an undefined selector is not re-evaluated by unrelated writes", () => {
        const source = atom(1, { name: "um-source-9" })
        const unrelated = atom(0, { name: "um-unrelated-9" })
        const [child, counter] = countingSelector(
            "um-child-9",
            undefined,
            source,
        )
        const parent = selector(
            get => {
                let reads = 0
                for (let i = 0; i < 5; i++)
                    if (get(child) === undefined) reads++
                return reads + get(unrelated)
            },
            { name: "um-parent-9" },
        )

        const testStore = store()
        testStore.sub(parent, () => {})
        expect(counter.evaluations).toBe(1)
        testStore.set(unrelated, 1)
        testStore.set(unrelated, 2)
        expect(counter.evaluations).toBe(1)
    })

    test("recovering from a throwing evaluation into undefined notifies", () => {
        // The propagation twin of the same flaw. A throwing evaluation DROPS
        // the selector's value (reEvaluateSelector's catch), so the next
        // propagation compares the new value against the absent-value
        // sentinel. When the selector recovers to `undefined`, `equal`
        // reported "unchanged": nothing was written, the dependent was never
        // re-evaluated, and the subscriber kept observing the pre-error value.
        const source = atom(1, { name: "um-source-11" })
        const child = selector<number | undefined>(
            get => {
                const value = get(source)
                if (value === 2) throw new Error("um-boom")
                return value === 3 ? undefined : 5
            },
            { name: "um-child-11" },
        )
        const parent = selector(get => `child=${get(child)}`, {
            name: "um-parent-11",
        })

        const testStore = store()
        const seen: string[] = []
        testStore.sub(parent, () => seen.push(testStore.get(parent)))
        expect(testStore.get(parent)).toBe("child=5")

        expect(() => testStore.set(source, 2)).toThrow()
        testStore.set(source, 3)

        // Was [] before the fix — the subscriber never learned child changed.
        expect(seen).toEqual(["child=undefined"])
        expect(testStore.get(parent)).toBe("child=undefined")
    })

    test("recovering from a throwing evaluation into undefined commits", () => {
        // The memoization half of the propagation fix: the recovered value
        // must be WRITTEN, not merely propagated, or the selector is left in
        // exactly the unmemoized state this whole file is about — every later
        // read re-runs its body.
        const source = atom(1, { name: "um-source-12" })
        let evaluations = 0
        const child = selector<number | undefined>(
            get => {
                evaluations++
                const value = get(source)
                if (value === 2) throw new Error("um-boom")
                return value === 3 ? undefined : 5
            },
            { name: "um-child-12" },
        )
        const parent = selector(
            get => {
                let reads = 0
                for (let i = 0; i < 10; i++) {
                    get(child)
                    reads++
                }
                return reads
            },
            { name: "um-parent-12" },
        )

        const testStore = store()
        testStore.sub(parent, () => {})
        // Whether the throw reaches this caller depends on what the subscriber
        // does; either way propagation's catch DROPS the child's value, which
        // is the state under test.
        try {
            testStore.set(source, 2)
        } catch {}
        expect(getStoreData(testStore).values.has(child)).toBe(false)

        testStore.set(source, 3)
        expect(getStoreData(testStore).values.has(child)).toBe(true)

        // The recovery is settled; nothing below may re-evaluate the child.
        const settled = evaluations
        for (let i = 0; i < 10; i++) testStore.get(parent)
        expect(evaluations).toBe(settled)
    })

    test("a selector re-entering undefined after a defined value stays memoized", () => {
        // The propagation path's own equal-vs-absent case without an error:
        // 5 -> undefined -> 5 -> undefined. Each transition must commit, so a
        // dependent that reads the child many times never pays per read.
        const source = atom(0, { name: "um-source-13" })
        let evaluations = 0
        const child = selector<number | undefined>(
            get => {
                evaluations++
                return get(source) % 2 === 0 ? undefined : 5
            },
            { name: "um-child-13" },
        )
        const parent = selector(
            get => {
                let reads = 0
                for (let i = 0; i < 10; i++) {
                    get(child)
                    reads++
                }
                return reads
            },
            { name: "um-parent-13" },
        )

        const testStore = store()
        testStore.sub(parent, () => {})
        expect(evaluations).toBe(1)

        // Four transitions, one child evaluation each — never ten.
        for (const next of [1, 2, 3, 4]) testStore.set(source, next)
        expect(evaluations).toBe(5)
        expect(getStoreData(testStore).values.has(child)).toBe(true)
    })

    test("transactions memoize undefined selectors too", () => {
        const source = atom(1, { name: "um-source-10" })
        const [child, counter] = countingSelector(
            "um-child-10",
            undefined,
            source,
        )
        const parent = selector(
            get => {
                let reads = 0
                for (let i = 0; i < 25; i++) {
                    if (get(child) === undefined) reads++
                }
                return reads
            },
            { name: "um-parent-10" },
        )

        const testStore = store()
        testStore.txn(txn => {
            expect(txn.get(parent)).toBe(25)
            for (let i = 0; i < 10; i++) txn.get(child)
        })
        expect(counter.evaluations).toBe(1)
    })
})
