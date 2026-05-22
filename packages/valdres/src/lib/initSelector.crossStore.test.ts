import { describe, test, expect } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { selector } from "../selector"

describe("cross-store selector eval — module-level state audit", () => {
    test("short cross-store read works", () => {
        const a2 = atom(10)
        const s2sel = selector(get => get(a2) + 100)
        const s2 = store()
        const proxy = selector(_get => s2.get(s2sel))
        const s1 = store()
        expect(s1.get(proxy)).toBe(110)
    })

    test("deep chain in store2 read from inside a store1 selector body", () => {
        const a2 = atom(0)
        const chain2: any[] = [selector(get => get(a2) + 1)]
        for (let i = 1; i < 150; i++) {
            const prev = chain2[i - 1]
            chain2.push(selector(get => get(prev) + 1))
        }
        const s2 = store()
        const tail2 = chain2[chain2.length - 1]
        const proxy = selector(_get => s2.get(tail2))
        const s1 = store()
        expect(s1.get(proxy)).toBe(150)
    })

    test("same selector nested-evaluated across two stores does NOT throw spurious cycle", () => {
        // sel's body, while evaluating in store1, synchronously evaluates
        // itself in store2. Two independent evaluations — not a real cycle.
        const a = atom(1)
        let allowCrossStore = false
        const s2 = store()
        const sel: any = selector(get => {
            const v = get(a)
            if (allowCrossStore) {
                allowCrossStore = false
                return v + s2.get(sel)
            }
            return v
        })
        const s1 = store()
        allowCrossStore = true
        expect(s1.get(sel)).toBe(2)
    })

    test("latestEvalContext: store2 eval does NOT revoke store1's deferred get tracking", async () => {
        // sel returns a promise. Inside that promise's resolution, sel calls
        // `get(b)` — a deferred (post-async) read. If latestEvalContext is
        // module-level, store2's later eval of `sel` flips store1's evalCtx
        // to `revoked: true`. Store1's deferred get then falls through the
        // "stale closure" branch, returning the value WITHOUT registering
        // the dep. Subsequent mutations of `b` won't dirty `sel` in store1.
        const a = atom(1)
        const b = atom(10)
        const sel: any = selector((get, _opts) => {
            const va = get(a)
            return Promise.resolve().then(() => va + get(b))
        })
        const s1 = store()
        const s2 = store()

        // Initial eval in s1 — kicks off async resolution
        const p1 = s1.get(sel)
        expect(p1).toBeInstanceOf(Promise)

        // Before s1's promise resolves, evaluate sel in s2.
        // This calls latestEvalContext.set(sel, ctx2) and marks s1's ctx as revoked.
        const p2 = s2.get(sel)
        expect(p2).toBeInstanceOf(Promise)

        // Let microtasks drain so the deferred get(b) in each store fires.
        await p1
        await p2

        // After the deferred get(b) in store1, `b` should be a registered
        // dependency of `sel` in store1. With the bug, it isn't.
        const s1Data = (s1 as any)._data ?? (s1 as any).data
        const deps = s1Data.stateDependencies.get(sel) as Set<unknown> | undefined
        expect(deps).toBeDefined()
        expect(deps!.has(b)).toBe(true)
    })
})
