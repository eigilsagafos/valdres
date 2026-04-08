import { describe, test } from "bun:test"
import { measure } from "mitata"
import { atom as valdresAtom } from "../../src/atom"
import { atomFamily as valdresAtomFamily } from "../../src/atomFamily"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"

const MEASURE_OPTS = {
    min_samples: 20,
    min_cpu_time: 1_500 * 1e6,
    warmup_samples: 5,
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}

describe("scope propagation", () => {
    test("set atom in root with 100 child scopes (no shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a) // initialize

        const scopes = Array.from({ length: 100 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            // Each scope has a selector depending on `a`
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel) // initialize selector in scope
            return s
        })

        let counter = 0
        const stats = await measure(() => {
            root.set(a, ++counter)
        }, MEASURE_OPTS)

        console.log(`  set atom, 100 scopes (no shadow): ${fmtNs(stats.p50)}`)
    })

    test("set atom in root with 100 child scopes (50 shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        const scopes = Array.from({ length: 100 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            // Half the scopes shadow the atom
            if (i % 2 === 0) s.set(a, 1000 + i)
            return s
        })

        let counter = 0
        const stats = await measure(() => {
            root.set(a, ++counter)
        }, MEASURE_OPTS)

        console.log(`  set atom, 100 scopes (50 shadow): ${fmtNs(stats.p50)}`)
    })

    test("family update with 100 child scopes (10 have family)", async () => {
        const root = valdresCreateStore()
        const family = valdresAtomFamily((...args: [string]) => args[0])
        const member = family("key1")
        root.get(member) // initialize

        const scopes = Array.from({ length: 100 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            // Only 10 scopes access the family (creating their own index)
            if (i < 10) {
                s.get(family("key1"))
            }
            return s
        })

        let counter = 0
        const stats = await measure(() => {
            root.set(member, `value-${++counter}`)
        }, MEASURE_OPTS)

        console.log(`  family update, 100 scopes (10 with family): ${fmtNs(stats.p50)}`)
    })

    test("set atom in root with 5 child scopes (realistic)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        const scopes = Array.from({ length: 5 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            return s
        })

        let counter = 0
        const stats = await measure(() => {
            root.set(a, ++counter)
        }, MEASURE_OPTS)

        console.log(`  set atom, 5 scopes (realistic): ${fmtNs(stats.p50)}`)
    })

    test("set atom in root with 10 child scopes (3 shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        const scopes = Array.from({ length: 10 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            if (i < 3) s.set(a, 1000 + i)
            return s
        })

        let counter = 0
        const stats = await measure(() => {
            root.set(a, ++counter)
        }, MEASURE_OPTS)

        console.log(`  set atom, 10 scopes (3 shadow): ${fmtNs(stats.p50)}`)
    })

    test("set atom in root with 1000 child scopes (no shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        const scopes = Array.from({ length: 1000 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            return s
        })

        let counter = 0
        const stats = await measure(() => {
            root.set(a, ++counter)
        }, MEASURE_OPTS)

        console.log(`  set atom, 1000 scopes (no shadow): ${fmtNs(stats.p50)}`)
    })
})
