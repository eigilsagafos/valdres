import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import { assertStoreInvariants } from "../../test/invariants/checkStoreInvariants"

/**
 * Descent-group contract for `settleTreeStore` (propagateUpdatedAtoms.ts).
 *
 * A store frame descending into its scopes builds `childGroups` from two
 * writers: `spreadGroup`, which maps this store's triggers onto the scopes that
 * registered an inherited-dependency branch for them, and the plan-children
 * merge, which adds every commit-forest child not already present. A scope can
 * be in BOTH sets — a scoped transaction writes into it (forest child) while a
 * root write in the same commit also branches into it.
 *
 * Absence is therefore represented as `undefined`, deliberately NOT as a shared
 * empty array. `spreadGroup` treats a missing or undefined list as "allocate a
 * fresh one", so the two writers commute and neither can append into state that
 * outlives the frame. A shared sentinel would instead make correctness depend on
 * `spreadGroup` running first: were the merge to run first, `spreadGroup` would
 * find the sentinel truthy and push into it, which both drops the group from
 * this commit's delivery (the sentinel is unwrapped to "no triggers" at the
 * recursion site) and leaks it into every later commit process-wide.
 *
 * These shapes pin that, so decomposing this file cannot reintroduce the
 * ordering dependency unnoticed.
 */

const build = (id: string) => {
    const root = store(id)
    // `both` is written by the transaction (forest child) AND reads a root atom
    // (branch target). `bystander` is only ever a forest child.
    const both = root.scope("both")
    const bystander = root.scope("bystander")

    const shared = atom(0, { label: "shared" })
    const local = atom(0, { label: "local" })
    const idle = atom(0, { label: "idle" })

    const sharedView = selector(get => get(shared) + 1, { label: "sharedView" })
    const localView = selector(get => get(local) * 2, { label: "localView" })
    const idleView = selector(get => get(idle) * 5, { label: "idleView" })

    const notifications: string[] = []
    both.sub(sharedView, () =>
        notifications.push(`shared:${both.get(sharedView)}`),
    )
    both.sub(localView, () => notifications.push(`local:${both.get(localView)}`))
    bystander.sub(idleView, () =>
        notifications.push(`idle:${bystander.get(idleView)}`),
    )

    return {
        root,
        both,
        bystander,
        shared,
        local,
        idle,
        sharedView,
        localView,
        idleView,
        notifications,
    }
}

describe("child descent groups", () => {
    test("a scope that is both a forest child and a branch target gets both", () => {
        const f = build("both-roles")

        f.root.txn(({ set, scope }) => {
            set(f.shared, 9)
            scope("both", txn => txn.set(f.local, 4))
        })

        // The root trigger must still reach `both` even though the plan-children
        // merge also names it. Losing `shared:10` here is the exact symptom of a
        // group appended into a shared empty sentinel.
        expect(f.notifications.sort()).toEqual(["local:8", "shared:10"])
        expect(f.both.get(f.sharedView)).toBe(10)
        expect(f.both.get(f.localView)).toBe(8)
        expect(f.bystander.get(f.idleView)).toBe(0)

        assertStoreInvariants(f.root)
        f.root.dispose()
    })

    test("a bystander child is untouched by the sibling's groups", () => {
        const f = build("bystander")

        f.root.txn(({ set, scope }) => {
            set(f.shared, 9)
            scope("both", txn => txn.set(f.local, 4))
            scope("bystander", txn => txn.set(f.idle, 3))
        })

        expect(f.notifications.sort()).toEqual([
            "idle:15",
            "local:8",
            "shared:10",
        ])
        expect(f.bystander.get(f.idleView)).toBe(15)
        // `bystander` inherits the root value but registered no branch for it.
        expect(f.bystander.get(f.sharedView)).toBe(10)

        assertStoreInvariants(f.root)
        f.root.dispose()
    })

    test("groups never leak into a later commit or a later store tree", () => {
        const first = build("leak-first")
        first.root.txn(({ set, scope }) => {
            set(first.shared, 9)
            scope("both", txn => txn.set(first.local, 4))
        })
        expect(first.notifications.sort()).toEqual(["local:8", "shared:10"])
        first.notifications.length = 0

        // A second commit that reaches its children with no root triggers at
        // all. Anything replayed here came from state outliving the first frame.
        first.root.txn(({ scope }) => {
            scope("both", txn => txn.set(first.local, 5))
        })
        expect(first.notifications).toEqual(["local:10"])
        first.root.dispose()

        const second = build("leak-second")
        second.root.txn(({ scope }) => {
            scope("both", txn => txn.set(second.local, 6))
        })
        expect(second.notifications).toEqual(["local:12"])
        expect(second.both.get(second.sharedView)).toBe(1)

        assertStoreInvariants(second.root)
        second.root.dispose()
    })
})
