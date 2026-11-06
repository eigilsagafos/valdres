import { describe, expect, test } from "bun:test"
import { atom } from "../../atom"
import { selector } from "../../selector"
import { store } from "../../store"
import { getStoreData } from "../getStoreData"
import {
    onLiveDependencyRemoved,
    reconcileLivenessAfterChurn,
} from "./mountAtom"
import type { State } from "../../types/State"

/**
 * The `GraphNode` accessor contract: **reads never allocate**. An absent record
 * means every field is at its default, so only a genuine mutation may create
 * one.
 *
 * Consolidating six WeakMaps into one record made it easy to write
 * `graphNodeFor(...)` where a peek would do, and every such site turns a walk
 * that merely PASSES THROUGH a node into one that materializes state for it.
 * The paths that matter are the ones which walk regions far wider than they
 * mutate — liveness reconciliation visits a whole churned region, orphan
 * cleanup stops at every live boundary it reaches, and both decrement paths run
 * over nodes that may already be at zero.
 *
 * These are deliberately UNIT tests against the graph functions rather than
 * scenario tests through the store. Measured on ShiftX's load reproduction, the
 * eager and peek-first versions allocate exactly the same 9,964 records: by the
 * time any of those walks reaches a node, `propagateLive` has normally already
 * given it one. So the contract is not observable end-to-end, and a scenario
 * test asserting it would pass whether or not the code honours it. Calling the
 * functions directly is what makes the assertion falsifiable.
 */

const nodesOf = (target: ReturnType<typeof store>) =>
    getStoreData(target).graphNodes

describe("graph node allocation contract", () => {
    test("decrementing a count on a state with no record allocates nothing", () => {
        const orphan = atom(0)
        const target = store()
        target.get(orphan)
        const nodes = nodesOf(target)
        expect(nodes.get(orphan)).toBeUndefined()

        // An absent record already means "live count 0", so there is nothing to
        // decrement — and nothing to allocate.
        onLiveDependencyRemoved(orphan as State, getStoreData(target))
        expect(nodes.get(orphan)).toBeUndefined()
    })

    test("a reconcile that changes no count allocates nothing", () => {
        // A seed with a dependency closure whose counts are all already correct.
        // Reconciliation must walk it and write nothing.
        const source = atom(1)
        const derived = selector(get => get(source) + 1)
        const target = store()
        target.get(derived)
        const data = getStoreData(target)
        const nodes = nodesOf(target)
        // The selector legitimately owns a record already — materializing its
        // dependency set assigns the stable `order`. The ATOM is the one with
        // nothing to record: never subscribed, so no liveness count.
        expect(nodes.get(derived)?.order).toBeGreaterThanOrEqual(0)
        expect(nodes.get(derived)?.live ?? 0).toBe(0)
        expect(nodes.get(source)).toBeUndefined()

        reconcileLivenessAfterChurn(new Set<State>([derived as State]), data)

        // Ground-truth liveness for the atom is 0, which is exactly what an
        // absent record already says, so the walk must not give it one.
        expect(nodes.get(source)).toBeUndefined()
    })

    test("a reconcile that DOES change a count still writes it", () => {
        // Non-vacuity: the peek must not turn into a silent no-op.
        const source = atom(1)
        const derived = selector(get => get(source) + 1)
        const target = store()
        const unsubscribe = target.sub(derived, () => {})
        target.get(derived)
        const data = getStoreData(target)
        const nodes = nodesOf(target)
        expect(nodes.get(source)?.live).toBe(1)

        // Corrupt the count, then reconcile: it must be repaired.
        nodes.get(source)!.live = 7
        reconcileLivenessAfterChurn(new Set<State>([derived as State]), data)
        expect(nodes.get(source)?.live).toBe(1)
        unsubscribe()
    })

    test("orphan cleanup leaves no record on the live boundary it stops at", () => {
        // `shared` stays live through `keeper`; tearing `doomed` down walks into
        // `shared` and stops there. That visit must not create a record for a
        // state that does not already have one — and when it legitimately does
        // (because it is live), the count must be untouched by the walk.
        const source = atom(0)
        const shared = selector(get => get(source) + 1)
        const keeper = selector(get => get(shared) + 1)
        const doomed = selector(get => get(shared) + 2)
        const target = store()
        const keep = target.sub(keeper, () => {})
        target.get(keeper)
        const nodes = nodesOf(target)
        const liveBefore = nodes.get(shared)?.live ?? 0

        const drop = target.sub(doomed, () => {})
        target.get(doomed)
        drop()
        target.get(keeper) // drains the queued orphan sweep

        expect(nodes.get(shared)?.live ?? 0).toBe(liveBefore)
        keep()
    })
})
