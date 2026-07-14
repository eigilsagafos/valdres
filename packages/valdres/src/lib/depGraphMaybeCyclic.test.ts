import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// The sticky `depGraphMaybeCyclic` flag lets every regionHasCycle gate
// (unsubscribe teardown, the removal-armed end-of-pass reconcile) skip its
// O(closure) walk while no cycle was ever committed. These tests pin down the
// flag's two obligations: it must STAY false across ordinary acyclic churn
// (that is the whole perf win — the flag is useless if common patterns trip
// it), and it must be SET by the time a cycle-closing edge has committed (a
// false negative would skip a required liveness reconcile → leaked counts).

test("stays false across acyclic subscribe/unsubscribe/dynamic-dep churn", () => {
    const s = store()
    const base = atom(1)
    const b = selector(get => get(base) + 1, { name: "b" })
    const c = selector(get => get(base) + 2, { name: "c" })
    const parity = atom(true)
    // Dynamic re-wire: toggling `parity` adds a NEW selector→selector edge on
    // a selector that already has a dependent — exactly the shape that makes
    // the commit-time probe walk. Acyclic, so the flag must survive it false.
    const dyn = selector(get => (get(parity) ? get(b) : get(c)), {
        name: "dyn",
    })
    const top = selector(get => get(dyn) * 10, { name: "top" })

    const unsub1 = s.sub(top, () => {})
    expect(s.get(top)).toBe(20)
    s.set(parity, false)
    expect(s.get(top)).toBe(30)
    s.set(parity, true)
    expect(s.get(top)).toBe(20)
    unsub1()

    // Re-subscribe after teardown (lazy re-init path) and churn again.
    const unsub2 = s.sub(top, () => {})
    s.set(parity, false)
    expect(s.get(top)).toBe(30)
    unsub2()

    expect((s as any).data.depGraphMaybeCyclic).toBe(false)
})

test("teardown of an acyclic subtree stays eager with the flag false", () => {
    const s = store()
    const cleanedUp: string[] = []
    const mounted = atom(0, {
        name: "mounted",
        onMount: () => () => cleanedUp.push("mounted"),
    })
    const mid = selector(get => get(mounted) + 1, { name: "mid" })
    const top = selector(get => get(mid) + 1, { name: "top" })

    const unsub = s.sub(top, () => {})
    expect(s.get(top)).toBe(2)
    unsub()

    // Eager semantics preserved: onMount cleanup fired synchronously on the
    // last unsubscribe, and the orphaned selectors left the dependency graph.
    expect(cleanedUp).toEqual(["mounted"])
    const data = (s as any).data
    expect(data.stateDependencies.has(top)).toBe(false)
    expect(data.stateDependencies.has(mid)).toBe(false)
    expect(data.liveDependentCount.get(mounted) ?? 0).toBe(0)
    expect(data.depGraphMaybeCyclic).toBe(false)
})

// Parity-gated cycle (same shape as the cyclic fuzzer): with `p` true the
// graph is acyclic; flipping `p` re-evaluates selA, committing a new edge
// selA→selB while selB→selA already exists — the closing edge of a cycle.
const makeCyclicPair = (s: ReturnType<typeof store>) => {
    const p = atom(true)
    const base = atom(1)
    const selA: any = selector(
        get => (get(p) ? get(base) : (get(selB) as number) + 1),
        { name: "selA" },
    )
    const selB: any = selector(get => (get(selA) as number) + 10, {
        name: "selB",
    })
    return { p, base, selA, selB }
}

test("set once a cycle-closing edge is committed", () => {
    const s = store()
    const { p, selB } = makeCyclicPair(s)
    const unsub = s.sub(selB, () => {})
    expect((s as any).data.depGraphMaybeCyclic).toBe(false)
    // Close the cycle: selA re-evaluates and now reads selB (cached), which
    // still depends on selA.
    s.set(p, false)
    expect((s as any).data.depGraphMaybeCyclic).toBe(true)
    unsub()
})

test("cyclic group still reconciles to non-live on unsubscribe", () => {
    const s = store()
    const { p, selA, selB } = makeCyclicPair(s)
    const unsub = s.sub(selB, () => {})
    s.set(p, false)
    // The cycle exists and the anchor subscriber leaves: without the
    // reconcile (gated behind the now-true flag), selA/selB keep each other's
    // liveDependentCount > 0 forever — the leak the reconcile exists to fix.
    unsub()
    const data = (s as any).data
    expect(data.liveDependentCount.get(selA) ?? 0).toBe(0)
    expect(data.liveDependentCount.get(selB) ?? 0).toBe(0)
})
