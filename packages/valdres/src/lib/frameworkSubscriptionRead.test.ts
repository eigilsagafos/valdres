import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { storeAdapter } from "../adapter-internals/v1"
import { selector } from "../selector"
import { store } from "../store"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { assertStoreInvariants } from "../../test/invariants/checkStoreInvariants"
import { measureArchitecture } from "../../test/utils/measureArchitecture"
import { getStoreData } from "./getStoreData"

describe("framework subscription reads", () => {
    test("an abandoned render returns its provisionally active graph to cold", async () => {
        const source = atom(1)
        const derived = selector(get => ({ value: get(source) * 2 }))
        const target = store()
        const data = getStoreData(target)

        const value = storeAdapter.getForSubscription(target, derived)
        expect(value).toEqual({ value: 2 })
        expect(data.selectorGraphActive.has(derived)).toBe(true)
        expect(data.stateDependents.get(source)).toContain(derived)

        await Promise.resolve()

        expect(data.selectorGraphActive.has(derived)).toBe(false)
        expect(data.coldSelectorCaches.has(derived)).toBe(true)
        expect(data.stateDependents.get(source)).not.toContain(derived)
        assertStoreInvariants(target, {
            states: [source, derived],
            quiescent: true,
        })
    })

    test("a committed subscription claims the observed graph", async () => {
        const source = atom(1)
        const derived = selector(get => get(source) * 2)
        const target = store()
        const data = getStoreData(target)

        expect(storeAdapter.getForSubscription(target, derived)).toBe(2)
        let notifications = 0
        const unsubscribe = target.sub(derived, () => notifications++)

        await Promise.resolve()
        expect(data.selectorGraphActive.has(derived)).toBe(true)
        expect(data.coldSelectorCaches.has(derived)).toBe(false)

        target.set(source, 2)
        expect(notifications).toBe(1)
        expect(target.get(derived)).toBe(4)

        unsubscribe()
        await Promise.resolve()
        assertStoreInvariants(target, {
            states: [source, derived],
            quiescent: true,
        })
    })

    test("render observation does not run lifecycle hooks before commit", async () => {
        let mounts = 0
        let unmounts = 0
        const source = atom(1, {
            onMount: () => {
                mounts++
                return () => unmounts++
            },
        })
        const derived = selector(get => get(source) * 2)
        const target = store()

        expect(storeAdapter.getForSubscription(target, derived)).toBe(2)
        expect(mounts).toBe(0)
        await Promise.resolve()
        expect(mounts).toBe(0)
        expect(unmounts).toBe(0)

        expect(storeAdapter.getForSubscription(target, derived)).toBe(2)
        const unsubscribe = target.sub(derived, () => {})
        expect(mounts).toBe(1)
        await Promise.resolve()
        expect(unmounts).toBe(0)

        unsubscribe()
        expect(unmounts).toBe(1)
    })

    test("a suspended observation stays resumable until its Promise settles", async () => {
        let resolve!: () => void
        const source = atom(21)
        const pending = selector(get =>
            new Promise<void>(done => (resolve = done)).then(
                () => get(source) * 2,
            ),
        )
        const target = store()
        const data = getStoreData(target)

        const snapshot = storeAdapter.getForSubscription(target, pending)
        expect(snapshot).toBeInstanceOf(Promise)

        // A suspended render cannot commit its subscription yet. The cleanup
        // turn must preserve this evaluation instead of making the retry start
        // a different Promise that nobody resolves.
        await Promise.resolve()
        expect(data.selectorGraphActive.has(pending)).toBe(true)
        expect(data.values.get(pending)).toBe(snapshot)

        resolve()
        expect(await snapshot).toBe(42)
        await Promise.resolve()

        expect(data.selectorGraphActive.has(pending)).toBe(false)
        expect(data.coldSelectorCaches.has(pending)).toBe(true)
        expect(target.get(pending)).toBe(42)
        assertStoreInvariants(target, {
            states: [source, pending],
            quiescent: true,
        })
    })

    test("an abandoned sibling cannot revoke a shared suspended graph", async () => {
        let resolve!: () => void
        let suspendedEvaluations = 0
        const source = atom(21)
        const shared = selector(get => get(source) * 2)
        const abandoned = selector(get => get(shared) + 1)
        const suspended = selector(get => {
            suspendedEvaluations++
            const value = get(shared)
            return new Promise<number>(done => {
                resolve = () => done(value)
            })
        })
        const target = store()
        const data = getStoreData(target)

        expect(storeAdapter.getForSubscription(target, abandoned)).toBe(43)
        const snapshot = storeAdapter.getForSubscription(target, suspended)

        // The first region is abandoned, but its dependency is shared by the
        // suspended region. Cleaning the first root must stop at that protected
        // graph instead of recursively revoking the Promise React will retry.
        await Promise.resolve()
        expect(data.values.get(suspended)).toBe(snapshot)
        expect(data.selectorGraphActive.has(suspended)).toBe(true)
        expect(storeAdapter.getForSubscription(target, suspended)).toBe(
            snapshot,
        )
        expect(suspendedEvaluations).toBe(1)

        resolve()
        expect(await snapshot).toBe(42)
        await Promise.resolve()

        expect(data.selectorGraphActive.has(suspended)).toBe(false)
        assertStoreInvariants(target, {
            states: [source, shared, abandoned, suspended],
            quiescent: true,
        })
    })

    test("a rejected suspended observation releases its provisional graph", async () => {
        let reject!: (error: Error) => void
        const source = atom(1)
        const pending = selector(get => {
            get(source)
            return new Promise<number>((_, fail) => {
                reject = fail
            })
        })
        const target = store()
        const data = getStoreData(target)

        const snapshot = storeAdapter.getForSubscription(target, pending)
        await Promise.resolve()
        expect(data.values.get(pending)).toBe(snapshot)

        reject(new Error("observation rejected"))
        await expect(snapshot).rejects.toThrow("observation rejected")
        await Promise.resolve()

        // Cheap orphan teardown may retain a weak active marker, but a rejected
        // evaluation must release every strongly held value and graph edge.
        expect(data.values.has(pending)).toBe(false)
        expect(data.stateDependencies.has(pending)).toBe(false)
        expect(data.stateDependents.get(source)).not.toContain(pending)
        assertStoreInvariants(target, {
            states: [source, pending],
            quiescent: true,
        })
    })

    test("store disposal drains a queued provisional observation", async () => {
        const source = atom(2)
        const derived = selector(get => get(source) * 2)
        const target = store()

        expect(storeAdapter.getForSubscription(target, derived)).toBe(4)
        target.dispose()
        await Promise.resolve()

        assertStoreInvariants(target, { states: [source, derived] })
    })

    test("store disposal drains a suspended provisional observation", async () => {
        const source = atom(2)
        const never = new Promise<number>(() => {})
        const pending = selector(get => {
            get(source)
            return never
        })
        const target = store()
        const data = getStoreData(target)

        expect(storeAdapter.getForSubscription(target, pending)).toBe(never)
        // Let observation cleanup enter its Promise-retention state before
        // disposal proves that terminal teardown does not wait for settlement.
        await Promise.resolve()
        expect(data.stateDependencies.has(pending)).toBe(true)

        target.dispose()

        expect(data.values.has(pending)).toBe(false)
        expect(data.stateDependencies.has(pending)).toBe(false)
        expect(data.stateDependents.get(source)).not.toContain(pending)
        assertStoreInvariants(target, { states: [source, pending] })
    })

    test("a stale shared graph catches up once, then snapshot reads are O(1)", async () => {
        const atomCount = 10
        const midCount = 12
        const topCount = 4
        const rootCount = 20
        const sources = Array.from({ length: atomCount }, () => atom(0))
        const mids = Array.from({ length: midCount }, (_, index) =>
            selector(get => {
                let sum = index
                for (const source of sources) sum += get(source)
                return sum
            }),
        )
        const tops = Array.from({ length: topCount }, (_, index) =>
            selector(get => {
                let sum = index
                for (const mid of mids) sum += get(mid)
                return sum
            }),
        )
        const roots = Array.from({ length: rootCount }, (_, index) =>
            selector(get => {
                let sum = index
                for (const top of tops) sum += get(top)
                return sum
            }),
        )
        const target = store()

        // Build one live shared graph, then leave every root cold.
        const unsubscribes = roots.map(root => target.sub(root, () => {}))
        for (const unsubscribe of unsubscribes) unsubscribe()
        await Promise.resolve()

        target.set(sources[0]!, 1)
        const expectedMidSum = midCount + (midCount * (midCount - 1)) / 2
        const expectedTopSum =
            topCount * expectedMidSum + (topCount * (topCount - 1)) / 2

        const first = measureArchitecture(target, () => {
            for (let index = 0; index < roots.length; index++) {
                expect(
                    storeAdapter.getForSubscription(target, roots[index]!),
                ).toBe(expectedTopSum + index)
            }
        })

        // Every unique selector runs once. Dependency comparisons are bounded
        // by the unique promoted edges, rather than repeated per snapshot root.
        expect(first.selectorEvaluations).toBe(midCount + topCount + rootCount)
        const uniqueEdges =
            atomCount * midCount + midCount * topCount + topCount * rootCount
        expect(first.coldCacheDependencyChecks).toBeLessThanOrEqual(uniqueEdges)

        const repeated = measureArchitecture(target, () => {
            for (const root of roots) {
                storeAdapter.getForSubscription(target, root)
                storeAdapter.getForSubscription(target, root)
            }
        })
        expect(repeated.selectorEvaluations).toBe(0)
        expect(repeated.coldCacheDependencyChecks).toBe(0)

        // Claim every provisional root before its cleanup microtask runs.
        const live = roots.map(root => target.sub(root, () => {}))
        await Promise.resolve()
        for (const unsubscribe of live) unsubscribe()
        await Promise.resolve()
        assertStoreInvariants(target, {
            states: [...sources, ...mids, ...tops, ...roots],
            quiescent: true,
        })
    })

    test("a dynamic cycle never escapes through provisional promotion", () => {
        const seed = atom(1)
        const flip = atom(0)
        let mid: any
        let top: any
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

        expect(() => target.sub(bottom, () => {})).toThrow(
            SelectorCircularDependencyError,
        )
        for (const state of [bottom, mid, top, bottom]) {
            expect(() =>
                storeAdapter.getForSubscription(target, state),
            ).toThrow(SelectorCircularDependencyError)
        }
    })

    test("a re-entrant equal-result write still returns the current root", () => {
        let target: ReturnType<typeof store>
        const trigger = atom(0)
        const shared = atom(1)
        const observer = selector(get => get(shared) * 10)
        const saboteur = selector(get => {
            if (get(trigger) === 1) target.set(shared, 7)
            return 0
        })
        const root = selector(get => get(observer) + get(saboteur))
        target = store()

        expect(target.get(root)).toBe(10)
        target.set(trigger, 1)

        expect(storeAdapter.getForSubscription(target, root)).toBe(70)
        expect(target.get(observer)).toBe(70)
        expect(target.get(root)).toBe(70)
    })

    test("promotion cleans an old dependency detached by a dynamic branch", async () => {
        const gate = atom(true)
        const leftSource = atom(1)
        const rightSource = atom(10)
        const left = selector(get => get(leftSource))
        const right = selector(get => get(rightSource))
        const root = selector(get => (get(gate) ? get(left) : get(right)))
        const target = store()
        const data = getStoreData(target)

        const unsubscribe = target.sub(root, () => {})
        unsubscribe()
        await Promise.resolve()
        target.set(gate, false)

        expect(storeAdapter.getForSubscription(target, root)).toBe(10)
        const claim = target.sub(root, () => {})
        await Promise.resolve()

        expect(data.selectorGraphActive.has(root)).toBe(true)
        expect(data.selectorGraphActive.has(right)).toBe(true)
        expect(data.selectorGraphActive.has(left)).toBe(false)
        expect(data.coldSelectorCaches.has(left)).toBe(true)

        claim()
        await Promise.resolve()
        assertStoreInvariants(target, {
            states: [gate, leftSource, rightSource, left, right, root],
            quiescent: true,
        })
    })
})
