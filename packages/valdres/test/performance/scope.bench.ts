import { describe, test } from "./test-compat"
import { measureOne } from "./bench-utils"
import { atom as valdresAtom } from "../../src/atom"
import { atomFamily as valdresAtomFamily } from "../../src/atomFamily"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"

// Valdres-only scope-propagation scaling (jotai has no scopes, so there is no
// competitor here). Recorded as `latency` benchmarks via measureOne so Bencher
// tracks and t-test-gates them like the rest of the suite, rather than only
// printing to the console.
describe("scope propagation", () => {
    test("set atom in root with 100 child scopes (no shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a) // initialize

        Array.from({ length: 100 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel) // initialize selector in scope
            return s
        })

        let counter = 0
        await measureOne("scope: set atom, 100 scopes (no shadow)", () => {
            root.set(a, ++counter)
        })
    })

    test("set atom in root with 100 child scopes (50 shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        Array.from({ length: 100 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            if (i % 2 === 0) s.set(a, 1000 + i) // half the scopes shadow
            return s
        })

        let counter = 0
        await measureOne("scope: set atom, 100 scopes (50 shadow)", () => {
            root.set(a, ++counter)
        })
    })

    test("family update with 100 child scopes (10 have family)", async () => {
        const root = valdresCreateStore()
        const family = valdresAtomFamily((...args: [string]) => args[0])
        const member = family("key1")
        root.get(member) // initialize

        Array.from({ length: 100 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            if (i < 10) s.get(family("key1")) // only 10 scopes access the family
            return s
        })

        let counter = 0
        await measureOne(
            "scope: family update, 100 scopes (10 with family)",
            () => {
                root.set(member, `value-${++counter}`)
            },
        )
    })

    test("set atom in root with 5 child scopes (realistic)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        Array.from({ length: 5 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            return s
        })

        let counter = 0
        await measureOne("scope: set atom, 5 scopes (realistic)", () => {
            root.set(a, ++counter)
        })
    })

    test("set atom in root with 10 child scopes (3 shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        Array.from({ length: 10 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            if (i < 3) s.set(a, 1000 + i)
            return s
        })

        let counter = 0
        await measureOne("scope: set atom, 10 scopes (3 shadow)", () => {
            root.set(a, ++counter)
        })
    })

    test("set atom in root with 1000 child scopes (no shadowing)", async () => {
        const root = valdresCreateStore()
        const a = valdresAtom(0)
        root.get(a)

        Array.from({ length: 1000 }, (_, i) => {
            const s = root.scope(`scope-${i}`)
            const sel = valdresSelector(get => get(a) + 1)
            s.get(sel)
            return s
        })

        let counter = 0
        await measureOne("scope: set atom, 1000 scopes (no shadow)", () => {
            root.set(a, ++counter)
        })
    })
})
