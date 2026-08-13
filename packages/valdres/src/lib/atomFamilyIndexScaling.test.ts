import { describe, expect, test } from "bun:test"
import { atomFamily } from "../atomFamily"
import { store } from "../store"
import { getStoreData } from "./getStoreData"

// A family's membership snapshot is a fresh, sorted, frozen array. Rendering it
// once per member write makes a run of K direct `set`/`del` calls O(K² log K):
// the cost of adding member 4,000 is proportional to the 3,999 already there.
// A transaction already avoids this by rendering once at its commit boundary
// (transaction.ts, `dirtyFamilyIndexes`), so only the direct path — the one an
// event handler or a `for` loop of `store.set(family(id), …)` uses — pays it.
//
// These are the guards for that: the cost of a direct membership write must not
// depend on how many members the family already has.

// A 4× spread, not 2×: it separates the two growth shapes far enough that
// neither side of the bound is close. Measured on this suite — linear lands at
// 2.3–3.2× (fixed per-store costs amortize, so it undershoots 4×) and the
// quadratic version it replaced landed at 18×. A 2× spread put healthy code at
// ~2× against a bound of 3, which a loaded runner could and did cross.
const SMALL = 1_000
const LARGE = 4 * SMALL
const MAX_GROWTH = 8
// Absolute slack for the small side, which is well under a millisecond: at that
// scale one scheduler preemption is a large relative error, and dividing by it
// is what makes wall-clock ratios flaky. Irrelevant to the signal — the
// regression this guards produced a LARGE side of ~1s.
const NOISE_FLOOR_MS = 5

const buildMembers = (memberCount: number) => {
    const family = atomFamily<number, [number]>(0)
    const members = Array.from({ length: memberCount }, (_, index) =>
        family(index),
    )
    return { family, members }
}

/** Wall-clock cost of `memberCount` direct (non-transaction) member creations.
 *  Member atoms are built before the clock starts, so the measurement covers
 *  only the per-write membership bookkeeping. */
const timeDirectCreates = (memberCount: number): number => {
    const target = store()
    const { family, members } = buildMembers(memberCount)
    const start = performance.now()
    for (const member of members) target.set(member, 1)
    const elapsed = performance.now() - start
    expect(target.get(family)).toHaveLength(memberCount)
    return elapsed
}

/** Wall-clock cost of `memberCount` direct member deletions. The members are
 *  populated in one transaction so only the deletions are measured. */
const timeDirectDeletes = (memberCount: number): number => {
    const target = store()
    const { family, members } = buildMembers(memberCount)
    target.txn(txn => {
        for (const member of members) txn.set(member, 1)
    })
    const start = performance.now()
    for (const member of members) target.del(member)
    const elapsed = performance.now() - start
    expect(target.get(family)).toHaveLength(0)
    return elapsed
}

/** Best of `runs` — a single sample can absorb a GC pause or a scheduler
 *  preemption, and the minimum is the one least contaminated by both. */
const bestOf = (runs: number, measure: () => number): number => {
    let best = Infinity
    for (let run = 0; run < runs; run++) {
        const elapsed = measure()
        if (elapsed < best) best = elapsed
    }
    return best
}

/** Total member slots written into rendered membership snapshots while
 *  `operation` runs. Every snapshot is published through `data.values.set`, so
 *  summing the lengths counts materialization work exactly, with no clock
 *  involved: O(K) per write shows up as O(K²) here. */
const countMaterializedMembers = (
    memberCount: number,
    prepare: "create" | "delete",
): number => {
    const target = store()
    const { family, members } = buildMembers(memberCount)
    if (prepare === "delete") {
        target.txn(txn => {
            for (const member of members) txn.set(member, 1)
        })
    }
    const data = getStoreData(target)
    const values = data.values
    let materializedMembers = 0
    data.values = {
        get: (state: WeakKey) => values.get(state),
        set: (state: WeakKey, value: any) => {
            if (state === family) materializedMembers += value.length
            return values.set(state, value)
        },
        has: (state: WeakKey) => values.has(state),
        delete: (state: WeakKey) => values.delete(state),
    } as typeof values

    try {
        if (prepare === "create") {
            for (const member of members) target.set(member, 1)
        } else {
            for (const member of members) target.del(member)
        }
    } finally {
        data.values = values
    }
    return materializedMembers
}

describe("atomFamily index deferral", () => {
    test("a direct write renders membership on first read, not on write", () => {
        const target = store()
        const family = atomFamily<number, [string]>(0)
        const a = family("a")
        const b = family("b")
        const data = getStoreData(target)

        target.set(a, 1)
        // The mirror of transaction.test.ts's "family membership renders lazily
        // on transaction read": the index knows the member immediately, the
        // array readers see is not built yet.
        expect(data.values.get(family).__index.renderedArray).toBeNull()
        target.set(b, 2)
        expect(data.values.get(family).__index.renderedArray).toBeNull()

        const members = target.get(family)
        expect(members).toStrictEqual([a, b])
        // Materialized in place, so every later reader — including one going
        // straight to the store's values — sees the snapshot, and a read with
        // no intervening write stays reference-stable.
        expect(data.values.get(family)).toBe(members)
        expect(target.get(family)).toBe(members)
    })

    test("deleting a member drops its creation entry", () => {
        const target = store()
        const family = atomFamily<number, [string]>(0)
        const a = family("a")
        const b = family("b")
        target.set(a, 1)
        target.set(b, 2)
        target.del(a)

        const index = getStoreData(target).values.get(family).__index
        // Only the tombstone survives: keeping both would make every render
        // walk members that were deleted an arbitrary time ago.
        expect(index.created.has(a)).toBe(false)
        expect(index.deleted.has(a)).toBe(true)
        expect(index.created.has(b)).toBe(true)
        expect(target.get(family)).toStrictEqual([b])
    })
})

describe("atomFamily index scaling", () => {
    // The two wall-clock guards below are the backstop for ANY superlinear
    // regression, including one the snapshot counter can't see (e.g. per-write
    // work that walks the index maps). The counters are the precise guard; these
    // are deliberately coarse, so keep them that way rather than tightening the
    // bound toward the measured value.
    test("direct member creates stay linear", () => {
        // Warm up so the first timed run isn't the one paying for JIT tiering.
        timeDirectCreates(SMALL / 4)
        const small = bestOf(5, () => timeDirectCreates(SMALL))
        const large = bestOf(5, () => timeDirectCreates(LARGE))
        expect(large).toBeLessThan(small * MAX_GROWTH + NOISE_FLOOR_MS)
    })

    test("direct member deletes stay linear", () => {
        timeDirectDeletes(SMALL / 4)
        const small = bestOf(5, () => timeDirectDeletes(SMALL))
        const large = bestOf(5, () => timeDirectDeletes(LARGE))
        expect(large).toBeLessThan(small * MAX_GROWTH + NOISE_FLOOR_MS)
    })

    test("direct member creates materialize O(members) snapshot slots", () => {
        const memberCount = 1_000
        // Two full snapshots of headroom: a write may leave the membership
        // deferred, but it must never render one snapshot per member.
        expect(countMaterializedMembers(memberCount, "create")).toBeLessThan(
            memberCount * 2,
        )
    })

    test("direct member deletes materialize O(members) snapshot slots", () => {
        const memberCount = 1_000
        expect(countMaterializedMembers(memberCount, "delete")).toBeLessThan(
            memberCount * 2,
        )
    })
})
