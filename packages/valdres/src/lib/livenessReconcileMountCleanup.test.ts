import { getStoreData } from "./getStoreData"
import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// The leak fix's PURPOSE is to release resources when a cyclic selector group
// loses its subscriber — i.e. fire onMount cleanups, not just zero a counter. The
// other liveness tests assert liveDependentCount; this one asserts the mount
// TRANSITION the reconcile drives: an onMount atom inside a cyclic region must be
// unmounted (its cleanup run) when the cycle is collected. A reconcile that got
// the count right but the mount transition wrong (e.g. wasLive vs the new live set
// diverging on a cyclic node) would leave a browser subscription running, and no
// count assertion would notice.
test("a cyclic region's onMount cleanup fires when its only subscriber leaves", () => {
    let mounts = 0
    let cleanups = 0
    const tracked = atom(0, {
        name: "cyc-mount.tracked",
        onMount: () => {
            mounts++
            return () => {
                cleanups++
            }
        },
    })
    const ax = atom(0, { name: "cyc-mount.ax" })
    const ay = atom(0, { name: "cyc-mount.ay" })

    let y: any
    // x always reads `tracked` (so tracked is live iff x is live) and, when ax is
    // even, reads y. y, when ay is odd, reads x — establishing the y→x edge while
    // x→y persists, so the dependency GRAPH has an x↔y cycle with no eval cycle
    // (values stay 0, so no propagation ping-pong).
    const x = selector(
        get => {
            get(tracked)
            return get(ax) % 2 === 0 ? get(y) : 0
        },
        { name: "cyc-mount.x" },
    )
    y = selector(get => (get(ay) % 2 === 0 ? 0 : get(x)), {
        name: "cyc-mount.y",
    })

    const s = store("cyc-mount")
    const unsub = s.sub(x, () => {}, false)

    // x live → reads tracked → tracked mounted.
    expect(mounts).toBe(1)
    expect(cleanups).toBe(0)
    expect(getStoreData(s).graphNodes.get(tracked)?.live ?? 0).toBe(1)
    expect(getStoreData(s).graphNodes.get(x)?.cycleRisk === true).toBe(false)

    // Close the cycle: ay odd makes y read x while x still reads y.
    s.set(ay, 1)
    expect(getStoreData(s).stateDependencies.get(x)).toContain(y)
    expect(getStoreData(s).stateDependencies.get(y)).toContain(x)
    // y (materialized before x) now points forward to x. That order-violating
    // edge marks the whole x↔y closure as requiring exact cycle detection.
    expect(getStoreData(s).graphNodes.get(x)?.cycleRisk === true).toBe(true)
    expect(getStoreData(s).graphNodes.get(y)?.cycleRisk === true).toBe(true)
    // tracked is still read by the (still-subscribed) x.
    expect(cleanups).toBe(0)

    // Unsubscribe the only anchor. propagateNotLive can't collect the x↔y cycle
    // (each keeps the other's count > 0), so the unsubscribe reconcile must mark
    // both non-live AND unmount `tracked`, firing its cleanup.
    unsub()
    expect(getStoreData(s).graphNodes.get(tracked)?.live ?? 0).toBe(0)
    expect(getStoreData(s).graphNodes.get(x)?.live ?? 0).toBe(0)
    expect(getStoreData(s).graphNodes.get(y)?.live ?? 0).toBe(0)
    // The actual resource release: every mount was cleaned up — no leaked
    // subscription left running on the collected cyclic group.
    expect(cleanups).toBe(mounts)
})

test("a nested cyclic region is collected when its subscribed parent leaves", () => {
    let cleanups = 0
    const tracked = atom(0, {
        name: "nested-cycle.tracked",
        onMount: () => () => {
            cleanups++
        },
    })
    const closeCycle = atom(false, { name: "nested-cycle.close" })

    let y: any
    const x = selector(
        get => {
            get(tracked)
            return get(y)
        },
        { name: "nested-cycle.x" },
    )
    y = selector(get => (get(closeCycle) ? get(x) : 0), {
        name: "nested-cycle.y",
    })
    const root = selector(get => get(x), { name: "nested-cycle.root" })

    const s = store("nested-cycle")
    const unsubscribeRoot = s.sub(root, () => {}, false)
    s.set(closeCycle, true)

    expect(getStoreData(s).stateDependencies.get(x)).toContain(y)
    expect(getStoreData(s).stateDependencies.get(y)).toContain(x)
    expect(getStoreData(s).graphNodes.get(x)?.live).toBe(2)

    // Removing root decrements x from 2 -> 1 and stops the incremental walk at
    // the nested x↔y cycle. The cycle-risk marker forces an exact reconcile,
    // which collects the cycle and releases its resource.
    unsubscribeRoot()

    expect(getStoreData(s).graphNodes.get(x)?.live ?? 0).toBe(0)
    expect(getStoreData(s).graphNodes.get(y)?.live ?? 0).toBe(0)
    expect(getStoreData(s).graphNodes.get(tracked)?.live ?? 0).toBe(0)
    expect(cleanups).toBe(1)
})

test("a throwing cyclic cleanup still queues orphaned graph cleanup", async () => {
    const tracked = atom(0, {
        name: "throwing-cycle.tracked",
        onMount: () => () => {
            throw new Error("cleanup boom")
        },
    })
    const closeCycle = atom(false, { name: "throwing-cycle.close" })

    let y: any
    const x = selector(
        get => {
            get(tracked)
            return get(y)
        },
        { name: "throwing-cycle.x" },
    )
    y = selector(get => (get(closeCycle) ? get(x) : 0), {
        name: "throwing-cycle.y",
    })
    const root = selector(get => get(x), { name: "throwing-cycle.root" })
    const s = store("throwing-cycle")
    const unsubscribe = s.sub(root, () => {}, false)
    s.set(closeCycle, true)

    expect(getStoreData(s).stateDependencies.get(x)).toContain(y)
    expect(getStoreData(s).stateDependencies.get(y)).toContain(x)
    expect(() => unsubscribe()).toThrow("cleanup boom")

    await Promise.resolve()
    // The whole cyclic region leaves the reverse graph despite the throwing
    // cleanup. Each member demotes to a cold cache — cyclic snapshots are an
    // explicitly supported shape (isColdSelectorCacheFresh guards recursion via
    // coldCacheValidationSet), so retention here does not resurrect the cycle.
    expect(getStoreData(s).stateDependents.get(x)?.has(root) ?? false).toBe(
        false,
    )
    expect(getStoreData(s).stateDependents.get(y)?.has(x) ?? false).toBe(false)
    expect(getStoreData(s).stateDependents.get(x)?.has(y) ?? false).toBe(false)
    expect(getStoreData(s).selectorGraphActive.has(root)).toBe(false)
    expect(getStoreData(s).coldSelectorCaches.has(root)).toBe(true)
    expect(getStoreData(s).coldSelectorCaches.has(x)).toBe(true)
    expect(getStoreData(s).coldSelectorCaches.has(y)).toBe(true)
})

test("acyclic dependency removals skip the exact cycle DFS", async () => {
    const chooseLeft = atom(true, { name: "cycle-gate.choose-left" })
    const source = atom(1, { name: "cycle-gate.source" })
    const left = selector(get => get(source) + 1, { name: "cycle-gate.left" })
    const right = selector(get => get(source) + 2, {
        name: "cycle-gate.right",
    })
    const dynamic = selector(
        get => (get(chooseLeft) ? get(left) : get(right)),
        { name: "cycle-gate.dynamic" },
    )
    const root = selector(get => get(dynamic), { name: "cycle-gate.root" })
    const s = store("cycle-gate")

    // Materialize both alternatives before the dynamic selector so either edge
    // descends the stable order and the closure marker can prove this is a DAG.
    s.get(left)
    s.get(right)
    const unsubscribe = s.sub(root, () => {}, false)
    expect(getStoreData(s).graphNodes.get(dynamic)?.cycleRisk === true).toBe(false)

    // The acyclic proof is now a field on the per-state graph record, so
    // snapshot it for every state in the region instead of spying on a map.
    const nodes = getStoreData(s).graphNodes
    const region = [chooseLeft, source, left, right, dynamic, root]
    const before = region.map(state => nodes.get(state)?.acyclicAt ?? -1)

    // This removes dynamic→left and adds dynamic→right. The removal arm is set,
    // but the unmarked seed closure proves no exact cycle scan is necessary —
    // so the DFS never runs, and no state gains a proof.
    s.set(chooseLeft, false)
    expect(region.map(state => nodes.get(state)?.acyclicAt ?? -1)).toEqual(
        before,
    )

    unsubscribe()
    await Promise.resolve()
})
