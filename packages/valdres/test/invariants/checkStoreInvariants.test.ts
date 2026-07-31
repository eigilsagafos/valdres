import { describe, expect, test } from "bun:test"
import { atom } from "../../src/atom"
import { selector } from "../../src/selector"
import { store } from "../../src/store"
import { getStoreData } from "../../src/lib/getStoreData"
import { trackAbortController } from "../../src/lib/storeLifecycle"
import {
    assertStoreInvariants,
    checkStoreInvariants,
    type InvariantCategory,
} from "./checkStoreInvariants"

// Every category below is proven falsifiable: build a real, consistent store,
// confirm the checker is silent, then corrupt exactly one internal structure
// and confirm the corresponding category fires. This is the acceptance gate —
// a checker that can never fail proves nothing.

const has = (violations: string[], category: InvariantCategory) =>
    violations.some(v => v.startsWith(`[${category}]`))

// Atom/selector names are global addresses and must be unique across the whole
// process — suffix every fixture name so tests don't collide.
let uid = 0
const n = (base: string) => `${base}.inv${uid++}`

describe("checkStoreInvariants — corrupted fixtures", () => {
    test("clean store reports no violations", () => {
        const a = atom(1, { name: n("a") })
        const b = atom(2, { name: n("b") })
        const s1 = selector(get => get(a) + get(b), { name: n("s1") })
        const s2 = selector(get => get(s1) * 2, { name: n("s2") })
        const st = store()
        const unsub = st.sub(s2, () => {}, false)
        expect(checkStoreInvariants(st, { states: [a, b, s1, s2] })).toEqual([])
        assertStoreInvariants(st)
        unsub()
    })

    test("symmetric-edges: a dropped reverse edge is caught", () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // s1 depends on a; sever the reverse edge only.
        data.stateDependents.get(a)!.delete(s1)
        const violations = checkStoreInvariants(st)
        expect(has(violations, "symmetric-edges")).toBe(true)
        unsub()
    })

    test("dependency-ownership: a missing materialization order is caught", () => {
        const a = atom(1, { name: n("a") })
        const b = atom(2, { name: n("b") })
        const s1 = selector(get => get(a) + get(b), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // s1 owns a dependency set but we drop its stable order marker.
        data.dependencyOrder.delete(s1)
        const violations = checkStoreInvariants(st)
        expect(has(violations, "dependency-ownership")).toBe(true)
        unsub()
    })

    test("dependency-ownership: a corrupt scope branch index is caught", () => {
        const g = atom(0, { name: n("g") })
        const s = selector(get => get(g) + 1, { name: n("s") })
        const root = store()
        const scope = root.scope("x")
        const unsub = scope.sub(s, () => {}, false)
        expect(checkStoreInvariants(root)).toEqual([])

        const parentData = getStoreData(root)
        const scopeData = getStoreData(scope)
        // The scope is still registered locally but drop it from the parent's
        // branch index — the two views now disagree.
        parentData.inheritedDependencyBranches.get(g)!.delete(scopeData)
        const violations = checkStoreInvariants(root)
        expect(has(violations, "dependency-ownership")).toBe(true)
        unsub()
        scope.dispose()
    })

    test("liveness-counts: a negative count is caught", () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        data.liveDependentCount.set(a, -1)
        expect(has(checkStoreInvariants(st), "liveness-counts")).toBe(true)
        unsub()
    })

    test("liveness-counts: a drifted count is caught", () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // Ground truth for `a` is 1 (one live dependent, s1). Force a mismatch.
        data.liveDependentCount.set(a, 5)
        expect(has(checkStoreInvariants(st), "liveness-counts")).toBe(true)
        unsub()
    })

    test("mount-state: a missing mountInClosure marker is caught", () => {
        let mounted = 0
        const m = atom(0, {
            name: n("m"),
            onMount: () => {
                mounted++
                return () => {
                    mounted--
                }
            },
        })
        const sm = selector(get => get(m), { name: n("sm") })
        const st = store()
        const unsub = st.sub(sm, () => {}, false)
        expect(mounted).toBe(1)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // sm has a mountable descendant (m) but no own hook — the marker is
        // required. Deleting it must be caught (no-false-negative invariant).
        data.mountInClosure.delete(sm)
        expect(has(checkStoreInvariants(st), "mount-state")).toBe(true)
        unsub()
    })

    test("mount-state: a mount with no hook is caught", () => {
        let mounted = 0
        const m = atom(0, {
            name: n("m"),
            onMount: () => {
                mounted++
                return () => {
                    mounted--
                }
            },
        })
        const a = atom(1, { name: n("a") })
        const s = selector(get => get(m) + get(a), { name: n("s") })
        const st = store()
        const unsub = st.sub(s, () => {}, false)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // `a` has no mount hook; a phantom mount entry is illegal.
        data.mounts.set(a, {})
        expect(has(checkStoreInvariants(st), "mount-state")).toBe(true)
        unsub()
    })

    test("resource-balance: an untracked abort controller is caught", () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // Attach a controller to a state without registering it in resources.
        data.abortControllers.set(s1, new AbortController())
        expect(has(checkStoreInvariants(st), "resource-balance")).toBe(true)
        unsub()
    })

    test("resource-balance: a stale ledger controller with no mapping is caught", () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        const data = getStoreData(st)

        // Map the current controller AND record it in the lifecycle ledger.
        const current = new AbortController()
        data.abortControllers.set(s1, current)
        trackAbortController(data, current)
        // Settled: forward and reverse checks both agree.
        expect(
            checkStoreInvariants(st, { quiescent: true, states: [s1] }),
        ).toEqual([])

        // Now leak a second controller into the ledger without mapping it —
        // the "forgot to untrack when replacing an evaluation" case. The
        // forward (map -> ledger) check cannot see it; the reverse check must.
        trackAbortController(data, new AbortController())
        expect(
            has(
                checkStoreInvariants(st, { quiescent: true, states: [s1] }),
                "resource-balance",
            ),
        ).toBe(true)
        unsub()
    })

    test("resource-balance: an active-index key with no subscribers is caught", () => {
        const a = atom(1, { name: n("a") })
        const b = atom(2, { name: n("b") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // b has no subscribers, but we leave a stale active-state index entry.
        data.subscriptionsRequireEqualCheck.set(b, undefined)
        expect(
            has(checkStoreInvariants(st, { states: [b] }), "resource-balance"),
        ).toBe(true)
        unsub()
    })

    test("disposed-terminal: a retained registration on a disposed store is caught", () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        unsub()
        st.dispose()
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // A terminal store must stay drained; re-introducing an active-state
        // key models a registration that outlived disposal.
        data.subscriptionsRequireEqualCheck.set(a, undefined)
        expect(has(checkStoreInvariants(st), "disposed-terminal")).toBe(true)
    })

    test("disposed-terminal: a retained cancellable and tree state are caught", () => {
        const st = store()
        st.dispose()
        expect(checkStoreInvariants(st)).toEqual([])

        const data = getStoreData(st)
        // The resource ledger is drained AND released on disposal, so model the
        // leak by putting a live ledger back with an un-cancelled entry.
        data.resources = { disposed: true, cancellables: {} as any }
        let violations = checkStoreInvariants(st)
        expect(has(violations, "disposed-terminal")).toBe(true)
        expect(
            violations.some(v => v.includes("1 cancellables resource(s)")),
        ).toBe(true)

        // Tree-owned commit state is terminal too — but only for a root. Keep
        // the store disposed (an empty, flagged ledger) so only the tree state
        // is the corruption under test.
        data.resources = { disposed: true }
        data.tree.commitEndListeners = new Set()
        data.tree.commitDepth = 1
        violations = checkStoreInvariants(st)
        expect(
            violations.some(v => v.includes("retains commitEndListeners")),
        ).toBe(true)
        expect(violations.some(v => v.includes("retains commitDepth 1"))).toBe(
            true,
        )
    })

    test("disposed-terminal: a detached scope is not blamed for its live root's tree state", () => {
        const root = store()
        const scoped = root.scope("invariant-scope")
        const scopedData = getStoreData(scoped)
        const unsub = root.onCommitEnd(() => {})
        scoped.detach()

        // The scope shares the still-live root's tree object. Its commit-end
        // listeners belong to the root, so the disposed scope must not report.
        expect(scopedData.tree.commitEndListeners?.size).toBe(1)
        expect(checkStoreInvariants(scoped)).toEqual([])
        unsub()
    })

    test("disposed-terminal: a WeakMap registration behind a cleared index is caught", () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        st.dispose()
        expect(checkStoreInvariants(st, { states: [a, s1] })).toEqual([])

        const data = getStoreData(st)
        // Re-introduce registrations ONLY in the WeakMaps, leaving the iterable
        // active-state index empty — the leak the early-return used to miss.
        data.subscriptions.set(
            a,
            new Set([
                {
                    callback: () => {},
                    requireDeepEqualCheckBeforeCallback: false,
                },
            ]) as any,
        )
        data.stateDependencies.set(s1, new Set([a]) as any)
        const violations = checkStoreInvariants(st, { states: [a, s1] })
        expect(has(violations, "disposed-terminal")).toBe(true)
        // Both the subscription and the dependency-set leaks are reported.
        expect(violations.some(v => v.includes("retains subscribers"))).toBe(
            true,
        )
        expect(
            violations.some(v => v.includes("retains a dependency set")),
        ).toBe(true)
    })

    test("retained-registration: an orphan leak after teardown is caught", async () => {
        const a = atom(1, { name: n("a") })
        const s1 = selector(get => get(a), { name: n("s1") })
        const st = store()
        const unsub = st.sub(s1, () => {}, false)
        unsub()
        // Flush the microtask-batched orphan sweep.
        await Promise.resolve()
        expect(
            checkStoreInvariants(st, { quiescent: true, states: [a, s1] }),
        ).toEqual([])

        const data = getStoreData(st)
        // Simulate a liveness bookkeeping leak on an orphaned state.
        data.liveDependentCount.set(a, 3)
        expect(
            has(
                checkStoreInvariants(st, { quiescent: true, states: [a] }),
                "retained-registration",
            ),
        ).toBe(true)
    })
})
