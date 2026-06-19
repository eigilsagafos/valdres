import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Minimal regression for the `liveDependentCount` desync fixed by
// `reconcileLivenessAfterChurn`: a selector (`newBranch`) that the subscribed
// `root` ends up reading is left with `liveDependentCount === undefined`
// (treated non-live) after the dependency graph churns through transitional,
// CYCLIC dependency sets within a single propagation pass — so a later write
// would never re-evaluate it and it would serve a stale value (the ShiftX scrub
// freeze).
//
// Pre-fix this fails with `Received: undefined`; with the fix `newBranch`'s
// count is correctly 1. The cycles (`oldCycle → root → oldBranch → oldCycle`,
// `newBranch ↔ newCycle`) are the essential ingredient — they make selectors
// re-evaluate multiple times per pass with dependency sets that appear then
// disappear, which is exactly the transient drop the eager liveness bookkeeping
// failed to reconcile. (Minimal graph found by Codex; the real-world reproducer
// is the ShiftX time-travel scrub over its selector DAG.)
test("live selector re-adds a dependency after transitional cyclic churn", () => {
    const a0 = atom(3, { name: "live-churn:a0" })
    const a1 = atom(0, { name: "live-churn:a1" })
    const a2 = atom(1, { name: "live-churn:a2" })

    let oldCycleEntry: any
    let root: any
    let oldBranch: any
    let oldCycle: any
    let newBranch: any
    let newCycle: any

    oldCycleEntry = selector(
        get => ((get(a2) + get(a0)) % 2 === 0 ? 0 : get(oldCycle) + get(a1)),
        { name: "live-churn:old-cycle-entry" },
    )
    oldBranch = selector(
        get =>
            (get(a0) + get(a1)) % 2 === 0
                ? get(a0) + get(oldCycle)
                : get(oldCycleEntry) + get(a2) + get(a1),
        { name: "live-churn:old-branch" },
    )
    oldCycle = selector(
        get =>
            (get(a0) + get(a2)) % 2 === 0
                ? get(a0) + get(root) + get(a0)
                : get(oldBranch) + get(oldCycleEntry),
        { name: "live-churn:old-cycle" },
    )
    newBranch = selector(
        get =>
            (get(a0) + get(a1)) % 2 === 0
                ? get(a0) + get(a1)
                : get(newCycle),
        { name: "live-churn:new-branch" },
    )
    newCycle = selector(
        get =>
            (get(a2) + get(a0)) % 2 === 0
                ? get(a2) + get(a0)
                : get(newBranch),
        { name: "live-churn:new-cycle" },
    )
    root = selector(
        get => ((get(a2) + get(a1)) % 2 === 0 ? get(newBranch) : get(oldBranch)),
        { name: "live-churn:root" },
    )

    const s = store("live-churn")
    s.sub(root, () => {}, false)

    // Warm the graph into a state where the subscribed root still points at the
    // old branch, then make the next branch switch churn through transitional
    // cyclic dependency sets before landing on newBranch.
    s.txn(t => {
        t.set(a2, 1)
        t.set(a1, 1)
        t.set(a1, 2)
    })
    s.txn(t => {
        t.set(a0, 2)
        t.set(a2, 3)
        t.set(a0, 2)
    })
    s.txn(t => {
        t.set(a1, 3)
        t.set(a1, 1)
    })
    s.set(a0, 3)

    expect(s.data.stateDependencies.get(root)).toContain(newBranch)
    expect(s.data.stateDependents.get(newBranch)).toContain(root)
    expect(s.data.liveDependentCount.get(newBranch)).toBe(1)
})
