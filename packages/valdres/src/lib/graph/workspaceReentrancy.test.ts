import { describe, expect, test } from "bun:test"
import { atom } from "../../atom"
import { selector } from "../../selector"
import { store } from "../../store"
import type { StoreData } from "../../types/StoreData"
import { createArchitectureInstrumentation } from "../architectureInstrumentation"
import { getStoreData } from "../getStoreData"
import {
    acquireLivenessWorkspace,
    acquireSchedulerWorkspace,
    dropGraphWorkspaces,
    releaseLivenessWorkspace,
    releaseSchedulerWorkspace,
} from "./workspace"

/**
 * Scratch-workspace ALLOCATOR contract (see graph/workspace.ts).
 *
 * Nested propagation and nested liveness reconciles each acquire their own
 * frame, so the invariant that protects correctness is ALIASING: two live
 * acquisitions must never hand back the same frame, at any depth. Pooling is
 * the allocation optimisation layered on top — it caps retention at
 * MAX_POOLED_FRAMES and lets deeper nesting overflow into unpooled frames that
 * are dropped rather than retained.
 *
 * SCOPE — read before adding to this file. These tests drive acquire/release
 * DIRECTLY. They pin what the allocator guarantees to any caller; they do NOT
 * exercise propagation control flow, and on their own they cannot catch a
 * decomposition that releases a frame before re-entering user lifecycle code.
 * That case is covered by "re-entrant mount writes use a distinct warm
 * scheduler frame" in ../architecturePerformance.test.ts: it drives a genuine
 * re-entrant mount write and asserts schedulerWorkAllocations === 0 alongside
 * exact evaluation counts and values, all of which aliasing would break. Add
 * lifecycle-driven cases there, not here.
 *
 * Why the direct-acquire tests exist at all: production today never nests
 * deeper than TWO concurrent scheduler frames and ONE liveness frame (measured
 * by instrumenting acquire/release across the whole suite — lifecycle writes
 * batch into the outer commit rather than opening a nested scheduler run). So
 * the >MAX_POOLED_FRAMES overflow path is currently unreachable through public
 * API, and only a direct-acquire test can pin it. It is pinned because
 * decomposition is expected to change nesting depth, and the overflow contract
 * must already hold when it does.
 */

// Mirrors MAX_POOLED_FRAMES in ./workspace. It is deliberately not exported —
// if the source constant changes, update this literal and the reuse counts.
const MAX_POOLED_FRAMES = 4
const DEPTH = MAX_POOLED_FRAMES + 3

/** Scheduler frames allocate one Map plus four arrays; liveness three arrays. */
const SCHEDULER_CONTAINERS = 5
const LIVENESS_CONTAINERS = 3

const withInstrumentation = <T>(data: StoreData, run: () => T) => {
    const instrumentation = createArchitectureInstrumentation()
    data.architectureInstrumentation = instrumentation
    try {
        const result = run()
        return { result, counters: { ...instrumentation.counters } }
    } finally {
        delete data.architectureInstrumentation
    }
}

describe("scheduler workspace re-entrancy", () => {
    test("nesting past MAX_POOLED_FRAMES never aliases a live frame", () => {
        const data = getStoreData(store())
        const held = Array.from({ length: DEPTH }, () =>
            acquireSchedulerWorkspace(data),
        )

        expect(new Set(held).size).toBe(DEPTH)
        for (const frame of held) expect(frame.inUse).toBe(true)

        for (const frame of held) releaseSchedulerWorkspace(frame)
        for (const frame of held) expect(frame.inUse).toBe(false)
    })

    test("the pool retains MAX_POOLED_FRAMES; deeper frames are dropped", () => {
        const data = getStoreData(store())
        const held = Array.from({ length: DEPTH }, () =>
            acquireSchedulerWorkspace(data),
        )
        for (const frame of held) releaseSchedulerWorkspace(frame)

        const { result: reacquired, counters } = withInstrumentation(data, () =>
            Array.from({ length: DEPTH }, () =>
                acquireSchedulerWorkspace(data),
            ),
        )

        // Exactly the pooled prefix comes back; the overflow frames were never
        // retained, so they are freshly allocated.
        expect(reacquired.filter(frame => held.includes(frame)).length).toBe(
            MAX_POOLED_FRAMES,
        )
        expect(counters.schedulerWorkAllocations).toBe(
            (DEPTH - MAX_POOLED_FRAMES) * SCHEDULER_CONTAINERS,
        )
        for (const frame of reacquired) releaseSchedulerWorkspace(frame)
    })

    test("a warm pooled acquire/release cycle allocates nothing", () => {
        const data = getStoreData(store())
        releaseSchedulerWorkspace(acquireSchedulerWorkspace(data))

        const { counters } = withInstrumentation(data, () => {
            for (let i = 0; i < 16; i++) {
                releaseSchedulerWorkspace(acquireSchedulerWorkspace(data))
            }
        })

        expect(counters.schedulerWorkAllocations).toBe(0)
    })
})

describe("liveness workspace re-entrancy", () => {
    test("nesting past MAX_POOLED_FRAMES never aliases a live frame", () => {
        const data = getStoreData(store())
        const held = Array.from({ length: DEPTH }, () =>
            acquireLivenessWorkspace(data),
        )

        expect(new Set(held).size).toBe(DEPTH)
        for (const frame of held) expect(frame.inUse).toBe(true)
        // Nested reconciles must not share scratch containers either.
        expect(new Set(held.map(frame => frame.stack)).size).toBe(DEPTH)
        expect(new Set(held.map(frame => frame.ordered)).size).toBe(DEPTH)
        expect(new Set(held.map(frame => frame.dfs)).size).toBe(DEPTH)

        for (const frame of held) releaseLivenessWorkspace(frame)
    })

    test("the pool retains MAX_POOLED_FRAMES; deeper frames are dropped", () => {
        const data = getStoreData(store())
        const held = Array.from({ length: DEPTH }, () =>
            acquireLivenessWorkspace(data),
        )
        for (const frame of held) releaseLivenessWorkspace(frame)

        const { result: reacquired, counters } = withInstrumentation(data, () =>
            Array.from({ length: DEPTH }, () => acquireLivenessWorkspace(data)),
        )

        expect(reacquired.filter(frame => held.includes(frame)).length).toBe(
            MAX_POOLED_FRAMES,
        )
        expect(counters.livenessWorkAllocations).toBe(
            (DEPTH - MAX_POOLED_FRAMES) * LIVENESS_CONTAINERS,
        )
        for (const frame of reacquired) releaseLivenessWorkspace(frame)
    })
})

describe("workspace pool disposal", () => {
    test("releasing a frame acquired before the drop does not resurrect it", () => {
        const data = getStoreData(store())
        const inFlight = acquireSchedulerWorkspace(data)

        // Disposal drops the whole pool while a frame is still checked out —
        // the shape of `dispose()` called from an onMount cleanup mid-settlement.
        dropGraphWorkspaces(data)
        releaseSchedulerWorkspace(inFlight)

        // The released frame is orphaned, not returned to a rebuilt pool.
        expect(acquireSchedulerWorkspace(data)).not.toBe(inFlight)
    })

    test("the rebuilt pool starts empty rather than inheriting dropped frames", () => {
        const data = getStoreData(store())
        const held = Array.from({ length: MAX_POOLED_FRAMES }, () =>
            acquireLivenessWorkspace(data),
        )
        for (const frame of held) releaseLivenessWorkspace(frame)

        dropGraphWorkspaces(data)

        const { result: rebuilt, counters } = withInstrumentation(data, () =>
            Array.from({ length: MAX_POOLED_FRAMES }, () =>
                acquireLivenessWorkspace(data),
            ),
        )

        for (const frame of rebuilt) expect(held).not.toContain(frame)
        expect(counters.livenessWorkAllocations).toBe(
            MAX_POOLED_FRAMES * LIVENESS_CONTAINERS,
        )
    })

    test("store disposal drops the pool, and a fresh store gets its own", () => {
        const first = store()
        const firstData = getStoreData(first)
        const source = atom(0)
        const derived = selector(get => get(source) * 2)
        first.sub(derived, () => {})
        first.set(source, 1)
        expect(first.get(derived)).toBe(2)

        const pooled = acquireSchedulerWorkspace(firstData)
        releaseSchedulerWorkspace(pooled)

        first.dispose()

        // The pool is gone, so the next acquire against the same StoreData
        // allocates rather than reusing scratch that outlived the store.
        expect(acquireSchedulerWorkspace(firstData)).not.toBe(pooled)

        const second = store()
        second.sub(derived, () => {})
        second.set(source, 3)
        expect(second.get(derived)).toBe(6)
        second.dispose()
    })
})
