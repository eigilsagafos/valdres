import { test, expect, mock, describe } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selectorFamily } from "../selectorFamily"
import { index } from "../indexConstructor"
import { selector } from "../selector"

test("deleting atom family member from root propagates into scope with cloned family", () => {
    const rootStore = store()
    const family = atomFamily<{ name: string }>(undefined, {
        name: "testFamily",
    })
    const atom1 = family("a")
    const atom2 = family("b")

    rootStore.set(atom1, { name: "A" })
    rootStore.set(atom2, { name: "B" })

    const countSelector = selector(get => get(family).length, {
        name: "countSelector",
    })

    // Create a scope and set a family member in it (clones family into scope)
    const scopedStore = rootStore.scope("test-scope")
    scopedStore.set(family("c"), { name: "C" })

    expect(rootStore.get(countSelector)).toBe(2)
    expect(scopedStore.get(countSelector)).toBe(3)

    // Subscribe to the count selector on the scoped store
    const scopeCallback = mock(() => {})
    scopedStore.sub(countSelector, scopeCallback)

    // Delete atom2 from root store
    rootStore.del(atom2)

    // The scope callback should fire because the family changed in root,
    // and the scope's family index inherits from root's
    expect(scopeCallback).toHaveBeenCalledTimes(1)
    expect(rootStore.get(countSelector)).toBe(1)
    expect(scopedStore.get(countSelector)).toBe(2)
})

test("propagateUpdatedAtoms", () => {
    const rootStore = store()
    const userFamily = atomFamily<
        {
            name: string
            country: string
            age: number
        },
        [number]
    >(undefined, { name: "prop-userFamily" })

    const userSettingsFamily = atomFamily(id => ({
        id,
        enabled: true,
        sessionDuration: 3600,
    }))

    const user1 = userFamily(1)
    const user2 = userFamily(2)
    const user3 = userFamily(3)

    // const

    const userNameSelector = selectorFamily(
        mock((id: number) => get => get(userFamily(id)).name),
        { name: "userNameSelector" },
    )
    const userAgeSelector = selectorFamily(
        mock((id: number) => get => get(userFamily(id)).age),
        { name: "userAgeSelector" },
    )
    const userInitialSelector = selectorFamily(
        mock((id: number) => get => get(userNameSelector(id))[0]),
        { name: "userInitialSelector" },
    )

    const userSummarySelector = selectorFamily(
        mock(
            id => get =>
                `${get(userNameSelector(id))} is ${get(userAgeSelector(id))} years old`,
        ),
        { name: "userSummarySelector" },
    )

    const allUserSummariesSelector = selector(get =>
        get(userFamily).map(atom =>
            get(userSummarySelector(...atom.familyArgs)),
        ),
    )

    const usersByCountry = index(
        userFamily,
        mock((doc, term: string) => doc.country === term),
        { name: "usersByCountry" },
    )
    const usersByAge = index(
        userFamily,
        mock((doc, term: number) => doc.age === term),
        { name: "usersByAge" },
    )

    const userUpdatedCallback = mock(() => {})
    const userSettingsUpdatedCallback = mock(() => {})
    const norwegianUserAddedCallback = mock(() => {})
    const age21UserAddedCallback = mock(() => {})
    const usersAgeUpdatedCallback = mock(() => {})
    const user1UpdatedCallback = mock(() => {})

    rootStore.sub(userFamily, userUpdatedCallback)
    rootStore.sub(userSettingsFamily, userSettingsUpdatedCallback)
    rootStore.sub(usersByCountry("Norway"), norwegianUserAddedCallback)
    rootStore.sub(usersByAge(21), age21UserAddedCallback)
    // rootStore.sub(userAgeSelector, usersAgeUpdatedCallback)
    rootStore.sub(user1, user1UpdatedCallback)

    expect(rootStore.get(userSettingsFamily(1))).toStrictEqual({
        id: 1,
        enabled: true,
        sessionDuration: 3600,
    })
    expect(userSettingsUpdatedCallback).toHaveBeenCalledTimes(1)
    // rootStore

    expect(rootStore.get(user1)).toBeInstanceOf(Promise)
    expect(rootStore.get(usersByCountry("Norway"))).toStrictEqual([])
    expect(rootStore.get(allUserSummariesSelector)).toStrictEqual([])

    rootStore.set(user1, { name: "Foo", age: 21, country: "Norway" })

    expect(user1UpdatedCallback).toHaveBeenCalledTimes(1)
    expect(userUpdatedCallback).toHaveBeenCalledTimes(1)
    expect(norwegianUserAddedCallback).toHaveBeenCalledTimes(1)

    expect(age21UserAddedCallback).toHaveBeenCalledTimes(1)
    expect(rootStore.get(usersByAge(21))).toStrictEqual([user1])
    expect(rootStore.get(usersByCountry("Norway"))).toStrictEqual([user1])
    expect(usersByAge.callback).toHaveBeenCalledTimes(1)
    expect(usersByCountry.callback).toHaveBeenCalledTimes(1)
    rootStore.set(user2, { name: "Bar", age: 42, country: "USA" })
    expect(rootStore.get(allUserSummariesSelector)).toStrictEqual([
        "Foo is 21 years old",
        "Bar is 42 years old",
    ])

    expect(rootStore.get(usersByCountry("Norway"))).toStrictEqual([user1])
})

describe("scopeValueIndex", () => {
    test("3-level deep family deletion: root → A → B with cloned family", () => {
        const rootStore = store()
        const family = atomFamily<string>(undefined, { name: "deepFamily" })
        const member1 = family("x")
        const member2 = family("y")

        rootStore.set(member1, "val1")
        rootStore.set(member2, "val2")

        const countSel = selector(get => get(family).length)

        // root → scopeA → scopeB (3 levels)
        const scopeA = rootStore.scope("A")
        const scopeB = scopeA.scope("B")

        // Set a family member in scopeB — this triggers initFamilyIndex which
        // walks up and creates family indexes in both A and B. This is the
        // invariant that recursivelyUpdateIndexes depends on: if B has a family
        // index, all ancestors (A, root) must also have one.
        scopeB.set(family("z"), "scopeB-only")

        expect(rootStore.get(countSel)).toBe(2)
        expect(scopeA.get(countSel)).toBe(2)
        expect(scopeB.get(countSel)).toBe(3) // x, y, z

        const bCallback = mock(() => {})
        scopeB.sub(countSel, bCallback)

        // Delete a member at root — must propagate through A down to B via
        // recursivelyUpdateIndexes (updates family index) and the
        // propagateDeletedAtoms scope loop (re-evaluates selectors)
        rootStore.del(member2)

        expect(bCallback).toHaveBeenCalledTimes(1)
        expect(rootStore.get(countSel)).toBe(1) // x
        expect(scopeB.get(countSel)).toBe(2)    // x, z
    })

    test("scopeValueIndex is empty after scope detach", () => {
        const rootStore = store()
        const atom1 = atom("hello")
        const family1 = atomFamily<string>(undefined, { name: "detachFamily" })

        const scoped = rootStore.scope("temp")
        // Set an atom and access a family in the scope
        scoped.set(atom1, "scoped")
        scoped.get(family1("a"))

        // scopeIndexKeys tracks what keys the scope registered in the parent's index
        const scopedData = scoped.data as any
        expect(scopedData.scopeIndexKeys.size).toBeGreaterThan(0)

        // The parent's index should point back to this scope for atom1
        expect(rootStore.data.scopeValueIndex.has(atom1)).toBe(true)

        // Detach the scope
        scoped.detach()

        // Parent's index entries for this scope's keys should be cleaned up
        expect(rootStore.data.scopeValueIndex.has(atom1)).toBe(false)
    })

    test("multi-atom transaction with partial shadowing propagates correctly", () => {
        const rootStore = store()
        const atom1 = atom(0)
        const atom2 = atom(0)
        const atom3 = atom(0)

        const sumSel = selector(get => get(atom1) + get(atom2) + get(atom3))

        const scoped = rootStore.scope("partial")
        // Shadow atom2 in the scope
        scoped.set(atom2, 100)

        const rootCallback = mock(() => {})
        const scopeCallback = mock(() => {})
        rootStore.sub(sumSel, rootCallback)
        scoped.sub(sumSel, scopeCallback)

        // Transaction sets all 3 atoms at root
        rootStore.txn(({ set }) => {
            set(atom1, 10)
            set(atom2, 20)
            set(atom3, 30)
        })

        // Root sees all changes: 10 + 20 + 30 = 60
        expect(rootStore.get(sumSel)).toBe(60)
        // Scope shadows atom2 (stays 100), inherits atom1=10, atom3=30: 10 + 100 + 30 = 140
        expect(scoped.get(sumSel)).toBe(140)
        expect(rootCallback).toHaveBeenCalledTimes(1)
        expect(scopeCallback).toHaveBeenCalledTimes(1)
    })

    test("4-level deep: atom set in A, read in D, then changed in C notifies D", () => {
        const A = store("A")
        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")

        const a = atom(1)
        A.set(a, 10)

        // D reads the atom (inherits from A through the chain)
        expect(D.get(a)).toBe(10)

        // D has a selector that depends on the atom
        const sel = selector(get => get(a) * 2)
        const dCallback = mock(() => {})
        D.sub(sel, dCallback)
        expect(D.get(sel)).toBe(20)

        // C shadows the atom — D should now read from C
        C.set(a, 50)

        expect(dCallback).toHaveBeenCalledTimes(1)
        expect(D.get(sel)).toBe(100) // 50 * 2

        // Further updates to C should also propagate to D
        C.set(a, 75)
        expect(dCallback).toHaveBeenCalledTimes(2)
        expect(D.get(sel)).toBe(150) // 75 * 2

        // A's value should be unchanged
        expect(A.get(a)).toBe(10)
    })

    test("diamond DAG: each selector evaluates once per atom update", () => {
        const rootStore = store()
        const a = atom(0)

        const counts = { b: 0, c: 0, d: 0 }
        const b = selector(get => {
            counts.b++
            return get(a) + 1
        })
        const c = selector(get => {
            counts.c++
            return get(a) + 2
        })
        const d = selector(get => {
            counts.d++
            return get(b) + get(c)
        })

        rootStore.sub(d, () => {})
        // Reset after initial materialization
        counts.b = 0
        counts.c = 0
        counts.d = 0

        rootStore.set(a, 1)
        expect(counts.b).toBe(1)
        expect(counts.c).toBe(1)
        expect(counts.d).toBe(1)

        counts.b = 0
        counts.c = 0
        counts.d = 0
        rootStore.set(a, 2)
        expect(counts.b).toBe(1)
        expect(counts.c).toBe(1)
        expect(counts.d).toBe(1)
    })

    test("diamond-of-diamonds: each selector evaluates at most once per propagation", () => {
        const rootStore = store()
        const a = atom(0)

        const counts = {
            b: 0, c: 0,
            d: 0, e: 0, f: 0, g: 0,
            h: 0, i: 0,
            j: 0,
        }
        // Layer 1: b, c both read a
        const b = selector(get => { counts.b++; return get(a) + 1 })
        const c = selector(get => { counts.c++; return get(a) + 2 })
        // Layer 2: d/e read b, f/g read c
        const d = selector(get => { counts.d++; return get(b) + 10 })
        const e = selector(get => { counts.e++; return get(b) + 20 })
        const f = selector(get => { counts.f++; return get(c) + 30 })
        const g = selector(get => { counts.g++; return get(c) + 40 })
        // Layer 3: h merges d+f (one diamond), i merges e+g (another)
        const h = selector(get => { counts.h++; return get(d) + get(f) })
        const i = selector(get => { counts.i++; return get(e) + get(g) })
        // Apex
        const j = selector(get => { counts.j++; return get(h) + get(i) })

        rootStore.sub(j, () => {})

        // Reset counts after initial materialization
        for (const k of Object.keys(counts) as (keyof typeof counts)[]) counts[k] = 0

        rootStore.set(a, 5)

        for (const [name, count] of Object.entries(counts)) {
            expect(count, `selector ${name} evaluated ${count} times`).toBe(1)
        }
    })

    test("asymmetric depth: D is reachable via B and via E→D, evaluated once", () => {
        // a → b
        // b → d (depth 2)
        // b → e → d (depth 3, would cause BFS to re-evaluate d)
        const rootStore = store()
        const a = atom(0)

        const counts = { b: 0, e: 0, d: 0 }
        const b = selector(get => { counts.b++; return get(a) + 1 })
        const e = selector(get => { counts.e++; return get(b) + 10 })
        const d = selector(get => { counts.d++; return get(b) + get(e) })

        rootStore.sub(d, () => {})
        counts.b = 0
        counts.e = 0
        counts.d = 0

        rootStore.set(a, 7)
        expect(counts.b).toBe(1)
        expect(counts.e).toBe(1)
        expect(counts.d).toBe(1)
        // And d sees the post-update value of e, not a stale value.
        expect(rootStore.get(d)).toBe((7 + 1) + (7 + 1 + 10))
    })

    test("leaf reads atom and chain link: final value is correct", () => {
        // Both `chain1` and `leaf` are in the initial dirty set (both read
        // the atom directly), AND `leaf` also reads `chain1`. The hybrid
        // first-sweep + topo-on-downstream scheduler may evaluate `leaf`
        // up to twice in this case (once in the linear sweep with a
        // possibly stale `chain1`, once in the topo settle). Whatever the
        // intermediate state, the *final* value the subscriber observes
        // must be correct.
        const rootStore = store()
        const a = atom(0)
        const chain1 = selector(get => get(a) + 1)
        const leaf = selector(get => get(a) + get(chain1))

        rootStore.sub(leaf, () => {})

        rootStore.set(a, 5)
        expect(rootStore.get(leaf)).toBe(5 + 5 + 1)
    })

    test("selectors evaluated in scopes do not pollute scopeValueIndex", () => {
        const rootStore = store()
        const atom1 = atom(1)
        const sel = selector(get => get(atom1) * 2)

        const scoped = rootStore.scope("seltest")
        // Evaluate selector in scope — caches value in scope's values WeakMap
        expect(scoped.get(sel)).toBe(2)

        // The scope's scopeIndexKeys should NOT contain the selector
        const scopedData = scoped.data as any
        for (const key of scopedData.scopeIndexKeys) {
            // All keys should be atoms or families, never selectors
            expect(typeof key === "object" && "get" in key && !("defaultValue" in key)).toBe(false)
        }

        // The parent's scopeValueIndex should not have the selector
        expect(rootStore.data.scopeValueIndex.has(sel)).toBe(false)
    })
})
