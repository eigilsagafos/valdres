import { describe, expect, test } from "bun:test"
import { atom } from "../src/atom"
import { atomFamily } from "../src/atomFamily"
import { selector } from "../src/selector"
import { store as createStore } from "../src/store"

// Regression guard: store.get(selector) must return a STABLE reference across
// repeated reads of a derived selector that has no live consumer (not
// subscribed, no live dependents) when nothing has changed.
//
// The bug: getDefault runs an init-only propagation (propagateAtomUpdate(...,
// true)) after the first read materializes the selector's atoms. That pass
// walked the just-computed selector and — finding no live consumer — deleted
// its freshly-cached value "for lazy re-eval", so the very next get()
// re-evaluated and returned a NEW reference. Values were always correct; only
// reference identity was unstable while unsubscribed. This is what tripped
// React's "The result of getSnapshot should be cached" warning at initial
// mount, before useSyncExternalStore established its subscription.
const makeStateAndSelector = () => {
    const itemFamily = atomFamily((id: number) => ({ id, label: `item-${id}` }))
    const listAtom = atom<number[]>([1, 2, 3])
    const derived = selector(get => {
        const ids = get(listAtom)
        return ids.map(id => get(itemFamily(id)))
    })
    return { itemFamily, listAtom, derived }
}

describe("unsubscribed selector reference stability", () => {
    for (const batchUpdates of [false, true]) {
        test(`reference is stable without a subscription (batchUpdates: ${batchUpdates})`, () => {
            const { listAtom, derived } = makeStateAndSelector()
            const s = createStore(batchUpdates ? { batchUpdates: true } : undefined)
            s.txn(({ set }) => {
                set(listAtom, [1, 2, 3])
            })

            // No subscription — pure reads. Every get must return the same ref.
            const a = s.get(derived)
            const b = s.get(derived)
            const c = s.get(derived)
            expect(a).toBe(b)
            expect(b).toBe(c)
        })
    }

    test("positive control: reference is stable WITH a subscription", () => {
        const { listAtom, derived } = makeStateAndSelector()
        const s = createStore()
        s.txn(({ set }) => {
            set(listAtom, [1, 2, 3])
        })
        const unsub = s.sub(derived, () => {})
        try {
            const a = s.get(derived)
            const b = s.get(derived)
            const c = s.get(derived)
            expect(a).toBe(b)
            expect(b).toBe(c)
        } finally {
            unsub()
        }
    })

    test("value is still correct (only identity was unstable)", () => {
        const { derived } = makeStateAndSelector()
        const s = createStore()
        expect(s.get(derived)).toEqual([
            { id: 1, label: "item-1" },
            { id: 2, label: "item-2" },
            { id: 3, label: "item-3" },
        ])
    })

    test("a real change still produces a new reference", () => {
        const { listAtom, derived } = makeStateAndSelector()
        const s = createStore()
        const before = s.get(derived)
        expect(s.get(derived)).toBe(before)
        s.txn(({ set }) => {
            set(listAtom, [1, 2])
        })
        const after = s.get(derived)
        expect(after).not.toBe(before)
        expect(after).toHaveLength(2)
        // ...and stable again after the change.
        expect(s.get(derived)).toBe(after)
    })

    test("chained selectors: both the top and an intermediate read are stable", () => {
        const a = atom([1, 2, 3])
        const mid = selector(get => get(a).map(x => x * 2))
        const top = selector(get => ({ doubled: get(mid) }))
        const s = createStore()
        // The restore only ever touches the read target, but every get() is its
        // own getDefault call, so reading the intermediate directly is stable too.
        const t1 = s.get(top)
        expect(s.get(top)).toBe(t1)
        const m1 = s.get(mid)
        expect(s.get(mid)).toBe(m1)
        // Reading the intermediate didn't disturb the top.
        expect(s.get(top)).toBe(t1)
    })

    test("async (promise-returning) selector keeps a stable pending reference", () => {
        const a = atom(1)
        // Promise-valued selectors are skipped by the init-only propagation, so
        // the restore must neither fire for them nor re-fire the pending promise.
        const sel = selector(get => Promise.resolve(get(a) + 1))
        const s = createStore()
        const p1 = s.get(sel)
        expect(s.get(sel)).toBe(p1)
    })
})
