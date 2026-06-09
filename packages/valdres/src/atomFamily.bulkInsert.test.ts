import { describe, expect, mock, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { selector } from "./selector"
import { store } from "./store"

/**
 * Pins the perf characteristic of bulk no-txn writes: each call to
 * `store.set(familyAtom)` must scale sub-quadratically with N (the family
 * size). Today the implementation rebuilds the rendered family array on
 * every write (`Array.from(index.created.keys())` in
 * `renderAtomFamilyIndex` root path), which is O(M) per write and O(N²)
 * cumulative across N writes.
 *
 * These tests are red until we fix that. The ratio assertion is the load-
 * bearing one — it catches "super-linear scaling" regardless of CPU speed,
 * which absolute-time assertions can't.
 */

const measureNoTxnBulk = (n: number): number => {
    const s = store()
    const family = atomFamily<number, [number]>()
    // Warmup the closure
    const tStart = performance.now()
    for (let i = 0; i < n; i++) {
        s.set(family(i), i)
    }
    return performance.now() - tStart
}

const median = (xs: number[]): number => {
    const sorted = [...xs].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
}

describe("atomFamily bulk no-txn insert", () => {
    test("scales sub-quadratically with N (linear-ish, not O(N²))", () => {
        // Warm the runtime
        measureNoTxnBulk(100)

        const smallN = 1_000
        const largeN = 10_000
        const iter = 5

        const smallSamples: number[] = []
        const largeSamples: number[] = []
        for (let i = 0; i < iter; i++) {
            smallSamples.push(measureNoTxnBulk(smallN))
            largeSamples.push(measureNoTxnBulk(largeN))
        }
        const smallMed = median(smallSamples)
        const largeMed = median(largeSamples)
        const sizeRatio = largeN / smallN // 10x
        const timeRatio = largeMed / smallMed

        // Useful diagnostic — appears in test output regardless of pass/fail.
        console.log(
            `[bulk no-txn] N=${smallN}: ${smallMed.toFixed(1)}ms, ` +
                `N=${largeN}: ${largeMed.toFixed(1)}ms, ` +
                `time-ratio: ${timeRatio.toFixed(1)}× ` +
                `(linear=${sizeRatio}×, quadratic=${sizeRatio * sizeRatio}×)`,
        )

        // Linear scaling on 10× more data is 10×; pure O(N²) is 100×.
        // A 20× ceiling captures genuine super-linearity while tolerating
        // GC / JIT / system-noise on a typical dev machine.
        expect(timeRatio).toBeLessThan(20)
    })

    test("absolute throughput stays under 250ms for 10k items", () => {
        // Backup assertion in case the ratio test gives a false positive
        // (e.g. if 1k itself is already slow, the ratio stays small while
        // both are bad). 250ms / 10k = 25µs per write. Pre-fix this test
        // sat at 2,648ms+ (O(N²) regime), so even with generous CI
        // headroom we still catch the regression by an order of magnitude.
        // Threshold sized for shared GitHub Actions runners which clock
        // 50–100ms vs ~10–20ms on fast dev machines for this workload.
        measureNoTxnBulk(100) // warmup
        const samples: number[] = []
        for (let i = 0; i < 5; i++) samples.push(measureNoTxnBulk(10_000))
        const m = median(samples)
        console.log(`[bulk no-txn] 10k absolute: ${m.toFixed(1)}ms`)
        expect(m).toBeLessThan(250)
    })
})

describe("atomFamily lazy-render staleness contract", () => {
    // Companion to the bulk-insert perf fix: we no longer eagerly
    // rebuild the family's rendered array on every write — we mark
    // dirty and materialize on next read. These tests pin the
    // observable consequences so future changes don't drift the
    // contract by accident.

    test("public store.get(family) is always fresh after a write", () => {
        const s = store()
        const user = atomFamily<{ id: number }, [number]>()
        const u1 = user(1)
        const u2 = user(2)

        expect(s.get(user)).toEqual([])

        s.set(u1, { id: 1 })
        expect(s.get(user)).toEqual([u1])

        s.set(u2, { id: 2 })
        expect(s.get(user)).toEqual([u1, u2])
    })

    test("selectors depending on the family see fresh values during propagation", () => {
        // The most load-bearing invariant: a selector that reads `family`
        // must observe the post-write state when it re-evaluates,
        // because the tracked `get` inside the selector body flows
        // through `getState` which triggers materialization.
        const s = store()
        const user = atomFamily<{ id: number }, [number]>()
        const count = selector(get => get(user).length)

        const seen: number[] = []
        s.sub(count, () => seen.push(s.get(count)))

        s.set(user(1), { id: 1 })
        s.set(user(2), { id: 2 })
        s.set(user(3), { id: 3 })

        expect(seen).toEqual([1, 2, 3])
    })

    test("family-level subscribers fire correctly", () => {
        const s = store()
        const user = atomFamily<{ id: number }, [number]>()

        const argsSeen: any[] = []
        s.sub(user, (id: number) => argsSeen.push(id))

        s.set(user(1), { id: 1 })
        s.set(user(2), { id: 2 })

        expect(argsSeen).toEqual([1, 2])
    })

    test("data.values.get(family).__index is always fresh (internal contract)", () => {
        // The wrapper `.__index` is the live index object — we mutate
        // `index.created` directly in `addFamilyAtomsToSet`, so anyone
        // reading `__index` (e.g. `findFamilyIndex`, `getState` for a
        // family atom) sees up-to-date data even though the wrapping
        // array's contents may be stale until materialization.
        const s = store()
        const user = atomFamily<{ id: number }, [number]>()
        s.get(user) // initialize wrapper in data.values
        s.set(user(1), { id: 1 })

        const wrapper = s.data.values.get(user)
        // `.__index.created` reflects the post-write state immediately,
        // even though `wrapper` itself (the array) may be the
        // pre-write rendered snapshot.
        expect(wrapper.__index.created.size).toBe(1)
    })

    test("EDGE CASE: external code reading data.values.get(family) directly sees stale", () => {
        // This is the documented downside of the lazy contract: any code
        // reaching into internal state without going through `store.get`
        // sees the array as it was at the last materialization. The
        // intended fix is to use the public API. We pin the behavior so
        // a future "always fresh" reversion that costs us the O(N) win
        // would surface here.
        const s = store()
        const user = atomFamily<{ id: number }, [number]>()
        const u1 = user(1)

        s.get(user) // materialize empty initial state
        s.set(u1, { id: 1 })

        // BEFORE the lazy fix: this returned [u1] eagerly.
        // AFTER the lazy fix: still [] because we haven't materialized.
        const internalStale = s.data.values.get(user)
        expect(internalStale).toEqual([])

        // Materialize via the public API
        const fresh = s.get(user)
        expect(fresh).toEqual([u1])

        // After materialization, internal state is in sync again.
        expect(s.data.values.get(user)).toEqual([u1])
    })

    test("subscriber callbacks that read via store.get see fresh state", () => {
        // The realistic version of the edge case above: a subscriber's
        // callback typically uses `store.get`, not `data.values`. The
        // public API materializes, so this works correctly.
        const s = store()
        const user = atomFamily<{ id: number }, [number]>()

        const observed: any[] = []
        s.sub(user, () => {
            observed.push(s.get(user).length)
        })

        s.set(user(1), { id: 1 })
        s.set(user(2), { id: 2 })

        expect(observed).toEqual([1, 2])
    })

    test("scope reads materialize through the scope's own dirty set", () => {
        // recursivelyUpdateIndexes marks scoped child stores dirty too,
        // so reads in scopes after a parent write still produce fresh
        // arrays via lazy materialization.
        const root = store("root")
        const child = root.scope("child")
        const user = atomFamily<{ id: number }, [number]>()
        const u1 = user(1)

        root.get(user) // init both root + initialize scope-touch later
        root.set(u1, { id: 1 })

        // Scope read materializes through the scope's getState path
        expect(child.get(user)).toEqual([u1])
    })

    test("a selector that throws after reading the family leaves the family materialized", () => {
        // If a selector reads `family` and then throws partway through
        // its body, the lazy render had already run when `get(family)`
        // was called. The family's rendered array stays correctly stored
        // in data.values regardless of whether the selector itself
        // recovers (selector error recovery is a separate valdres concern).
        const s = store()
        const user = atomFamily<{ id: number }, [number]>()
        const flaky = selector(get => {
            const arr = get(user)
            if (arr.length > 1) throw new Error("too many")
            return arr.length
        })

        s.set(user(1), { id: 1 })
        expect(s.get(flaky)).toBe(1)

        s.set(user(2), { id: 2 })
        // valdres wraps the inner error; just check that it throws.
        expect(() => s.get(flaky)).toThrow()

        // Family is still materialized correctly even though the
        // selector that triggered the materialization threw.
        expect(s.get(user).length).toBe(2)
    })
})
