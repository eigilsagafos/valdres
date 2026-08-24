import { describe, expect, test } from "bun:test"
import { atom } from "../../atom"
import { atomFamily } from "../../atomFamily"
import { selector } from "../../selector"
import { selectorFamily } from "../../selectorFamily"
import { store } from "../../store"
import { getStoreData } from "../getStoreData"

/** Unsubscribe teardown is deferred to a microtask; any public store op drains
 *  it. Read an unrelated atom so the orphan sweep runs without touching the
 *  selector under test. */
const flushOrphanCleanup = (s: any) => s.get(atom("flush"))

describe("orphaned selectors demote to a cold cache", () => {
    test("remount with nothing changed does not re-evaluate", () => {
        let evaluations = 0
        const source = atom(1)
        const derived = selector(get => {
            evaluations++
            return { value: get(source) * 2 }
        })
        const s = store()

        const unsubscribe = s.sub(derived, () => {})
        const mounted = s.get(derived)
        expect(evaluations).toBe(1)

        unsubscribe()
        flushOrphanCleanup(s)

        const remountUnsubscribe = s.sub(derived, () => {})
        expect(s.get(derived)).toEqual({ value: 2 })
        // The whole point: a remount re-wires the graph, it does not re-run the
        // selector body.
        expect(evaluations).toBe(1)
        // ...and it is the same value, so useSyncExternalStore's getSnapshot
        // stays Object.is-stable across the unmount/remount boundary.
        expect(s.get(derived)).toBe(mounted)
        remountUnsubscribe()
    })

    test("remount re-evaluates when a dependency changed while unmounted", () => {
        let evaluations = 0
        const source = atom(1)
        const derived = selector(get => {
            evaluations++
            return get(source) * 2
        })
        const s = store()

        const unsubscribe = s.sub(derived, () => {})
        expect(s.get(derived)).toBe(2)
        expect(evaluations).toBe(1)

        unsubscribe()
        flushOrphanCleanup(s)

        // The write lands while nothing observes the selector, so no reverse
        // edge carries it. The retained revision snapshot is what makes the
        // next read notice.
        s.set(source, 5)

        const remountUnsubscribe = s.sub(derived, () => {})
        expect(s.get(derived)).toBe(10)
        expect(evaluations).toBe(2)
        remountUnsubscribe()
    })

    test("a remounted selector is notified again on a dependency write", () => {
        const source = atom(1)
        const derived = selector(get => get(source) * 2)
        const s = store()

        const unsubscribe = s.sub(derived, () => {})
        unsubscribe()
        flushOrphanCleanup(s)

        let notifications = 0
        const remountUnsubscribe = s.sub(derived, () => notifications++)
        s.set(source, 3)
        // Demotion removes the reverse edges; promotion has to rebuild them or
        // the selector stays subscribed but permanently detached.
        expect(notifications).toBe(1)
        expect(s.get(derived)).toBe(6)
        remountUnsubscribe()
    })

    test("promotion restores the reverse edge, not just the value", () => {
        const source = atom(1)
        const derived = selector(get => get(source) + 1)
        const s = store()
        const data = getStoreData(s)

        const unsubscribe = s.sub(derived, () => {})
        expect(data.stateDependents.get(source)?.has(derived)).toBe(true)

        unsubscribe()
        flushOrphanCleanup(s)
        // Demoted: forward set retained (that is what promotion rebuilds from),
        // reverse edge gone, value kept.
        expect(data.stateDependents.get(source)?.has(derived) ?? false).toBe(
            false,
        )
        expect(data.stateDependencies.has(derived)).toBe(true)
        expect(data.values.has(derived)).toBe(true)

        const remountUnsubscribe = s.sub(derived, () => {})
        expect(data.stateDependents.get(source)?.has(derived)).toBe(true)
        remountUnsubscribe()
    })

    test("a chain of selectors demotes and remounts without re-evaluating", () => {
        let inner = 0
        let outer = 0
        const source = atom(1)
        const mid = selector(get => {
            inner++
            return get(source) * 2
        })
        const top = selector(get => {
            outer++
            return get(mid) + 1
        })
        const s = store()

        const unsubscribe = s.sub(top, () => {})
        expect(s.get(top)).toBe(3)
        expect([inner, outer]).toEqual([1, 1])

        unsubscribe()
        flushOrphanCleanup(s)

        const remountUnsubscribe = s.sub(top, () => {})
        expect(s.get(top)).toBe(3)
        expect([inner, outer]).toEqual([1, 1])

        // ...and the rebuilt graph still propagates through both levels.
        s.set(source, 10)
        expect(s.get(top)).toBe(21)
        expect([inner, outer]).toEqual([2, 2])
        remountUnsubscribe()
    })

    test("churn over a shared high-fan-in selector costs no re-evaluations", () => {
        const N = 25
        let layoutEvaluations = 0
        let rowEvaluations = 0
        const items = atomFamily((id: number) => ({ id, weight: id }))
        const layout = selector(get => {
            layoutEvaluations++
            let acc = 0
            const offsets: number[] = []
            for (let i = 0; i < N; i++) offsets.push((acc += get(items(i)).weight))
            return offsets
        })
        const rows = selectorFamily((id: number) => (get: any) => {
            rowEvaluations++
            return get(layout)[id]
        })
        const s = store()

        const subs = new Map<number, () => void>()
        for (let i = 0; i < N; i++) subs.set(i, s.sub(rows(i), () => {}))
        for (let i = 0; i < N; i++) s.get(rows(i))
        expect(layoutEvaluations).toBe(1)
        expect(rowEvaluations).toBe(N)

        // Every row unmounts and remounts — a virtualized list scrolling away
        // and back, or a route leave/return.
        for (let cycle = 0; cycle < 3; cycle++) {
            for (const unsubscribe of subs.values()) unsubscribe()
            subs.clear()
            flushOrphanCleanup(s)
            for (let i = 0; i < N; i++) subs.set(i, s.sub(rows(i), () => {}))
            for (let i = 0; i < N; i++) s.get(rows(i))
        }
        expect(layoutEvaluations).toBe(1)
        expect(rowEvaluations).toBe(N)

        // A write after all that churn still reaches every remounted row.
        let notifications = 0
        for (let i = 0; i < N; i++) {
            subs.get(i)!()
            subs.set(i, s.sub(rows(i), () => notifications++))
        }
        s.set(items(0), { id: 0, weight: 100 })
        expect(notifications).toBe(N)
        for (const unsubscribe of subs.values()) unsubscribe()
    })

    test("an enumerable store keeps drop semantics", () => {
        // `values` is a strong Map there, so a retained entry would outlive the
        // selector rather than dying with it — and store.snapshot() (public API,
        // and what @valdres/redux-devtools enumerates) would start listing
        // torn-down selectors.
        let evaluations = 0
        const source = atom(1)
        const derived = selector(get => {
            evaluations++
            return get(source) * 2
        })
        const s = store(undefined, { enumerable: true })
        const data = getStoreData(s)

        const unsubscribe = s.sub(derived, () => {})
        expect(s.get(derived)).toBe(2)
        unsubscribe()
        flushOrphanCleanup(s)

        expect(data.values.has(derived)).toBe(false)
        expect(data.stateDependencies.has(derived)).toBe(false)
        expect(
            s.snapshot().some((entry: any) => entry.state === derived),
        ).toBe(false)
        // ...and it pays the re-evaluation that non-enumerable stores now avoid.
        const remountUnsubscribe = s.sub(derived, () => {})
        expect(s.get(derived)).toBe(2)
        expect(evaluations).toBe(2)
        remountUnsubscribe()
    })

    test("a selector orphaned by a rolled-back activation demotes safely", () => {
        // rollbackSelectorActivation -> cleanupOrphanedDeps: a child that
        // materialized before its parent's evaluation threw reaches the retain
        // branch without ever having had a subscriber.
        let childEvaluations = 0
        const source = atom(1)
        const child = selector(get => {
            childEvaluations++
            return get(source) + 1
        })
        const parent = selector(get => {
            get(child)
            throw new Error("parent boom")
        })
        const s = store()

        expect(() => s.sub(parent, () => {})).toThrow("Selector eval crashed")
        flushOrphanCleanup(s)

        // The child survives as a cold snapshot and still tracks its dependency.
        expect(s.get(child)).toBe(2)
        expect(childEvaluations).toBe(1)
        s.set(source, 5)
        expect(s.get(child)).toBe(6)
        expect(childEvaluations).toBe(2)

        // ...and it can still be promoted into a live graph afterwards.
        let notifications = 0
        const unsubscribe = s.sub(child, () => notifications++)
        s.set(source, 9)
        expect(notifications).toBe(1)
        expect(s.get(child)).toBe(10)
        unsubscribe()
    })

    test("a pending async selector is still dropped, not demoted", async () => {
        const source = atom(1)
        let resolvePending!: (value: number) => void
        const pending = selector(get => {
            get(source)
            return new Promise<number>(resolve => {
                resolvePending = resolve
            })
        })
        const s = store()
        const data = getStoreData(s)

        const unsubscribe = s.sub(pending, () => {})
        expect(data.values.has(pending)).toBe(true)

        unsubscribe()
        await Promise.resolve()
        // Its abort controller is untracked and its evaluation identity revoked,
        // so the promise must not survive as a cache entry.
        expect(data.values.has(pending)).toBe(false)
        expect(data.stateDependencies.has(pending)).toBe(false)

        resolvePending(42)
        await Promise.resolve()
        expect(data.values.has(pending)).toBe(false)
    })
})
