import { describe, expect, mock, test } from "bun:test"
import { wait } from "../test/utils/wait"
import { atom } from "./atom"
import { atomFamily } from "./atomFamily"
import { selector } from "./selector"
import { store } from "./store"

describe("selector", () => {
    test("throws if given an async function", () => {
        expect(() => {
            selector(async get => {
                return get(atom(1))
            })
        }).toThrow(/async/i)
    })

    test("allows sync function that returns a Promise", () => {
        expect(() => {
            selector(get => {
                return Promise.resolve(get(atom(1)))
            })
        }).not.toThrow()
    })

    test("computations are cached", () => {
        const store1 = store()
        const numberAtom = atom(5, { name: "sel-cache-atom" })
        const callback = mock(get => get(numberAtom) * 100)
        const time100Selector = selector(callback, { name: "selector" })
        expect(store1.get(time100Selector)).toBe(500)
        expect(store1.get(time100Selector)).toBe(500)
        expect(store1.get(time100Selector)).toBe(500)
        expect(store1.get(time100Selector)).toBe(500)
        expect(store1.get(time100Selector)).toBe(500)
        // Computed exactly once: getDefault restores the freshly-computed value
        // of the read selector after the init-only propagation that would
        // otherwise drop it, so the next read hits the cache instead of
        // re-evaluating (previously this was 2 — the init pass invalidated the
        // just-computed value and the second read recomputed it).
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("dependents/dependencies are correctly handled for selector dependent on atom", () => {
        const rootStore = store()
        const numberAtom = atom(5, { name: "numberAtom" })
        const time100Selector = selector(get => get(numberAtom) * 100, {
            name: "time100Selector",
        })

        rootStore.get(time100Selector)
        const { stateDependents, stateDependencies } = rootStore.data

        expect(stateDependents.get(numberAtom)).toHaveLength(1)
        expect(stateDependents.get(time100Selector)).toBeUndefined
        expect(stateDependencies.get(time100Selector)).toHaveLength(1)
        expect(stateDependencies.get(numberAtom)).toBeUndefined()
        expect(stateDependencies.get(time100Selector)).toStrictEqual(
            new Set([numberAtom]),
        )
        expect(stateDependents.get(numberAtom)).toStrictEqual(
            new Set([time100Selector]),
        )
    })
    test("dependents/dependencies are correctly handled for selector dependent on atomFamily", () => {
        const rootStore = store()
        const usersFamily = atomFamily(null, { name: "usersFamily" })
        const allUserIds = selector(get => get(usersFamily), {
            name: "allUserIds",
        })

        rootStore.get(allUserIds)
        const { stateDependents, stateDependencies } = rootStore.data

        expect(stateDependents.get(usersFamily)).toHaveLength(1)
        expect(stateDependents.get(allUserIds)).toBeUndefined
        expect(stateDependencies.get(allUserIds)).toHaveLength(1)
        expect(stateDependencies.get(usersFamily)).toBeUndefined()
        expect(stateDependencies.get(allUserIds)).toStrictEqual(
            new Set([usersFamily]),
        )
        expect(stateDependents.get(usersFamily)).toStrictEqual(
            new Set([allUserIds]),
        )
    })

    test("one level selectors update", () => {
        const store1 = store()
        const numberAtom = atom(5)
        const callback = mock(get => get(numberAtom) * 100)
        const time100Selector = selector(callback, {
            name: "times 100 selector",
        })
        expect(store1.get(time100Selector)).toBe(500)
        expect(callback).toHaveBeenCalledTimes(1)
        store1.set(numberAtom, 10)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(store1.get(time100Selector)).toBe(1000)
        expect(callback).toHaveBeenCalledTimes(2)
    })

    test("nested selectors update", () => {
        const store1 = store()
        const baseAtom = atom(10)
        const callbackLevel1 = mock(get => get(baseAtom) * 10)
        const selectorLevel1 = selector(callbackLevel1, {
            name: "selectorLevel1",
        })
        const callbackLevel2 = mock(get => get(selectorLevel1) * 10)
        const selectorLevel2 = selector(callbackLevel2, {
            name: "selectorLevel2",
        })
        expect(store1.get(selectorLevel1)).toBe(100)
        expect(store1.get(selectorLevel2)).toBe(1000)
        store1.set(baseAtom, 20)
        expect(store1.get(selectorLevel1)).toBe(200)
        expect(store1.get(selectorLevel2)).toBe(2000)
    })

    test("conditional nested selector subscriptions update", () => {
        const store1 = store()
        const boolAtom = atom(true, { name: "sel-cond-bool" })
        const atom1 = atom(1, { name: "sel-cond-atom1" })
        const atom2 = atom(2, { name: "sel-cond-atom2" })

        const callback1 = mock(get => {
            if (get(boolAtom)) {
                return get(atom1)
            } else {
                return get(atom2)
            }
        })

        // The first time we get selector1 it should subscribe to boolAtom and atom1
        const selector1 = selector(callback1)
        expect(store1.get(selector1)).toBe(1)
        expect(callback1).toHaveBeenCalledTimes(1)

        // When we change boolAtom to false selector1 should now subscribe to boolAtom and atom2
        store1.set(boolAtom, false)
        expect(store1.get(selector1)).toBe(2)
        expect(callback1).toHaveBeenCalledTimes(2)

        // Changing atom1 should not trigger a re-eval of selector1
        store1.set(atom1, 3)
        expect(callback1).toHaveBeenCalledTimes(2)
    })


    // test("selector with promise",async () => {
    //     const store1 = store()
    //     const baseAtom = atom(10)
    //     const callback = mock(({get}) => wait(10).then(() => get(baseAtom)) )
    //     const selector1 = selector(callback, "selector1")
    //     expect(store1.get(selector1)).toBeInstanceOf(Promise)
    //     await wait(10)
    //     expect(store1.get(selector1)).toBe(10)
    // })

    // test("selector that accesses async atom", async () => {
    //     const store1 = store()
    //     const asyncFunction = () => new Promise((resolve) => setTimeout(() => resolve("done"), 10))
    //     const atom1 = atom(async () => {
    //         await wait(10)
    //         return "atom1"
    //     })
    //     const atom2 = atom(async () => {
    //         await wait(20)
    //         return "atom2"
    //     })
    //     const callback1 = mock(({ get }) => {
    //         return [get(atom1), get(atom2)]
    //     })
    //     const selector1 = selector(callback1, undefined, "selector1")
    //     expect(store1.get(selector1)).toBeInstanceOf(Promise)
    //     // await wait(10)
    // })

    test("selector with multiple async gets", async () => {
        const store1 = store()
        const asyncAtom1 = atom(() => wait(1).then(() => 1), {
            name: "asyncAtom1",
        })
        const asyncAtom2 = atom(() => wait(1).then(() => 2), {
            name: "asyncAtom2",
        })

        const selector1 = selector(
            get => {
                return [get(asyncAtom1), get(asyncAtom2)]
            },
            { name: "selector1" },
        )
        expect(store1.get(selector1)).toBeInstanceOf(Promise)
        expect(store1.data.values.get(asyncAtom1)).toBeInstanceOf(Promise)
        expect(store1.data.values.get(asyncAtom2)).toBeUndefined()
        expect(store1.data.values.get(selector1)).toBeInstanceOf(Promise)
        await wait(1)
        expect(store1.data.values.get(asyncAtom1)).toBe(1)
        expect(store1.data.values.get(asyncAtom2)).toBeInstanceOf(Promise)
        expect(store1.data.values.get(selector1)).toBeInstanceOf(Promise)
        await wait(1)
        expect(store1.data.values.get(asyncAtom1)).toBe(1)
        expect(store1.data.values.get(asyncAtom2)).toBe(2)
        expect(store1.data.values.get(selector1)).toStrictEqual([1, 2])

        store1.set(asyncAtom1, 3)
        store1.set(asyncAtom2, 4)
        // TODO: This test now does not pass now due to the change in update strategy.
        expect(store1.data.values.get(selector1)).toBeUndefined()
        expect(store1.get(selector1)).toStrictEqual([3, 4])
        expect(store1.data.values.get(selector1)).toStrictEqual([3, 4])
    })

    test("selector that returns promise is handled correctly", async () => {
        const store1 = store()
        const selector1 = selector(() => wait(1).then(() => "done"))
        const res = store1.get(selector1)
        expect(res).toBeInstanceOf(Promise)
        expect(res).toBe(store1.get(selector1))
        const resolved = await res
        expect(resolved).toBe("done")
        expect(store1.get(selector1)).toBe("done")
    })

    // test("selector updates only run once when used at different levels", () => {
    //     const store1 = store()
    //     const atom1 = atom(1)
    //     let callbackLog: string[] = []
    //     const callback1 = mock(({get}) => {
    //         callbackLog.push("selector1")
    //         return get(atom1) + get(atom1)
    //     }) // 2, 4
    //     const callback2 = mock(({get}) =>{
    //         callbackLog.push("selector2")
    //         return get(selector1)
    //     }) // 2, 4
    //     const callback3 = mock(({get}) => {
    //         callbackLog.push("selector3")
    //         return get(selector1) + get(selector2)
    //     }) // 4, 8
    //     const callback4 = mock(({get}) => {
    //         callbackLog.push("selector4")
    //         return get(selector1) + get(selector2) + get(selector3)
    //     }) // 8, 16
    //     const selector1 = selector(callback1, undefined, "selector1")
    //     const selector2 = selector(callback2, undefined, "selector2")
    //     const selector3 = selector(callback3,undefined, "selector3")
    //     const selector4 = selector(callback4, undefined, "selector4")
    //     expect(store1.get(selector4)).toBe(8)
    //     expect(callback1).toHaveBeenCalledTimes(1)
    //     expect(callback2).toHaveBeenCalledTimes(1)
    //     expect(callback3).toHaveBeenCalledTimes(1)
    //     expect(callback4).toHaveBeenCalledTimes(1)
    //     callbackLog = []
    //     store1.set(atom1, 2)
    //     callbackLog = []
    //     expect(store1.get(selector1)).toBe(4)
    //     expect(store1.get(selector2)).toBe(4)
    //     expect(store1.get(selector3)).toBe(8)
    //     expect(store1.get(selector4)).toBe(16)
    //     expect(callbackLog).toBeEmpty()
    //     // expect(store1.get(selector2)).toBe(16)
    //     // expect(store1.get(selector3)).toBe(16)
    //     // expect(store1.get(selector4)).toBe(16)
    //     // expect(callback1).toHaveBeenCalledTimes(2)
    //     // expect(callback2).toHaveBeenCalledTimes(2)
    //     // expect(callback3).toHaveBeenCalledTimes(2)
    //     // expect(callback4).toHaveBeenCalledTimes(2)

    // })

    test("selector listening to atomFamily", () => {
        // Should we allow this? Maybe directly but not in selectors?
        const store1 = store()
        const keysAtomFamily = atomFamily(false)
        const user1 = store1.set(keysAtomFamily("a"), true)
        const user2 = store1.set(keysAtomFamily("b"), true)
        keysAtomFamily("c") // This will not be part of set
        const selector1 = selector(
            get => get(keysAtomFamily).map(atom => atom.familyArgs),
            {
                name: "Selector1",
            },
        )
        const subCallback = mock(() => {})
        store1.sub(keysAtomFamily, subCallback)
        const res1 = store1.get(selector1)
        expect(res1).toStrictEqual([["a"], ["b"]])
        expect(subCallback).toHaveBeenCalledTimes(0)
        store1.set(keysAtomFamily("d"), true)
        expect(subCallback).toHaveBeenCalledTimes(1)
        const res2 = store1.get(selector1)
        expect(res2).toStrictEqual([["a"], ["b"], ["d"]])
        store1.set(keysAtomFamily("b"), false)
    })

    test("Trying to set a selector returns an error", async () => {
        const store1 = store()
        const atom1 = atom(1)
        const selector1 = selector(get => get(atom1) + get(atom1))
        expect(() => store1.set(selector1, 5)).toThrowError(
            /You provided a `selector`./,
        )
    })

    test("circular dependency named selectors", () => {
        const selector3 = selector(get => get(selector1), {
            name: "Selector 3",
        })
        const selector2 = selector(get => get(selector3), {
            name: "Selector 2",
        })
        const selector1 = selector(get => get(selector2), {
            name: "Selector 1",
        })
        const defaultStore = store()
        expect(() => defaultStore.get(selector1)).toThrowError(
            `Circular dependency detected in 'Selector 1'
[START] Selector 1
         Selector 2
          Selector 3
[CRASH] Selector 1`,
        )
    })

    test("circular dependency anonymous selectors", () => {
        const selector3 = selector(get => get(selector2))
        const selector2 = selector(get => get(selector1))
        const selector1 = selector(get => get(selector3))
        const defaultStore = store()
        expect(() => defaultStore.get(selector1)).toThrowError(
            `Circular dependency detected in 'Anonymous Selector'
[START] Anonymous Selector
         Anonymous Selector
          Anonymous Selector
[CRASH] Anonymous Selector`,
        )
    })

    test("nested selectors error stack trace", () => {
        const selector5 = selector(
            get => {
                throw new Error("Foo")
            },
            { name: "Selector 5" },
        )
        const selector4 = selector(get => get(selector5), {
            name: "Selector 4",
        })
        const selector3 = selector(get => get(selector4), {
            name: "Selector 3",
        })
        const selector2 = selector(get => get(selector3), {
            name: "Selector 2",
        })
        const selector1 = selector(get => get(selector2), {
            name: "Selector 1",
        })
        const defaultStore = store()
        expect(() => defaultStore.get(selector1)).toThrowError(
            `Selector eval crashed in 'Selector 5'
[START] Selector 1
         Selector 2
          Selector 3
           Selector 4
[CRASH] Selector 5`,
        )
    })

    test("dervied atom triggers", () => {
        const primitiveAtom = atom(undefined)
        const selector1 = selector(get => get(primitiveAtom))
        const conditionalSelector = selector(get => {
            const base = get(primitiveAtom)
            if (!base) return
            return get(selector1)
        })

        const rootStore = store()
        const onChangeDerived = mock(() => {})

        rootStore.sub(selector1, onChangeDerived)
        rootStore.sub(conditionalSelector, () => {})

        expect(onChangeDerived).toHaveBeenCalledTimes(0)
        rootStore.set(primitiveAtom, 1)
        // expect(onChangeDerived).toHaveBeenCalledTimes(1)
    })

    test("selector that throws does not leak into circular-dep tracking", () => {
        // Regression: a shared module-level WeakSet is used for circular
        // dependency detection. Before this fix, an inner selector throwing
        // a non-cycle error left both the inner and the outer in the set,
        // so the next read of the outer falsely tripped the cycle check.
        const store1 = store()
        const atom1 = atom(0, { name: "sel-circ-atom1" })

        let shouldThrow = true
        const innerSelector = selector(
            get => {
                get(atom1)
                if (shouldThrow) throw new Error("transient")
                return "inner ok"
            },
            { name: "inner" },
        )
        const outerSelector = selector(get => get(innerSelector), {
            name: "outer",
        })

        expect(() => store1.get(outerSelector)).toThrow(
            "Selector eval crashed",
        )

        shouldThrow = false

        // Must not throw SelectorCircularDependencyError — the dependency
        // graph is statically acyclic.
        expect(store1.get(outerSelector)).toBe("inner ok")
    })

    test("subscription propagation does not leak after selector throws", () => {
        // Same leak, exercised via the reEvaluateSelector path
        // (propagateUpdatedAtoms passes circularDependencySet=undefined,
        //  which defaults to the shared set).
        const store1 = store()
        const atom1 = atom(0, { name: "sel-prop-atom1" })

        let shouldThrow = false
        const innerSelector = selector(
            get => {
                const v = get(atom1)
                if (shouldThrow) throw new Error("transient")
                return v + 1
            },
            { name: "inner" },
        )
        const outerSelector = selector(get => get(innerSelector) * 2, {
            name: "outer",
        })

        const unsub = store1.sub(outerSelector, () => {})
        expect(store1.get(outerSelector)).toBe(2)

        // Atom change while inner throws — propagation should not corrupt
        // the shared circular-dep set even though re-evaluation crashes.
        shouldThrow = true
        store1.set(atom1, 1)

        shouldThrow = false
        store1.set(atom1, 2)

        expect(store1.get(outerSelector)).toBe(6)
        unsub()
    })

    test("store.get does not leak stale atoms after a selector throws", () => {
        const store1 = store()
        const atom1 = atom(1, { name: "sel-stale-atom1" })
        const atom2 = atom(10, { name: "sel-stale-atom2" })
        const atom3 = atom(99, { name: "sel-stale-atom3" })

        // A crashing selector that initializes atom1 before throwing.
        // atom1 has never been read, so getState will init it and add
        // it to the internal _initSet.
        const crashingSelector = selector(get => {
            get(atom1)
            throw new Error("boom")
        })

        expect(() => store1.get(crashingSelector)).toThrow("Selector eval crashed")

        // Now set up a selector + subscriber that depends on atom1
        const goodSelector = selector(get => get(atom1) * 2)
        expect(store1.get(goodSelector)).toBe(2)
        const callback = mock(() => {})
        store1.sub(goodSelector, callback)

        // Get an unrelated, never-initialized atom. Bug: if _initSet
        // leaked atom1 from the crashed get, this call will run
        // propagateUpdatedAtoms for atom1, spuriously notifying
        // goodSelector's subscriber.
        expect(store1.get(atom3)).toBe(99)
        expect(callback).toHaveBeenCalledTimes(0)
    })

    test("selector in scope dependent on atom not set in scope but in parent scope works correctly ", () => {
        const rootStore = store()
        const nestedStore = rootStore.scope("nested")
        const globalSettings = atom<{ theme: string }>(undefined, {
            name: "globalSettings",
        })
        const themeSelector = selector(get => get(globalSettings).theme, {
            name: "themeSelector",
        })

        rootStore.set(globalSettings, { theme: "dark" })
        expect(nestedStore.get(themeSelector)).toBe("dark")
        rootStore.set(globalSettings, { theme: "light" })
        expect(nestedStore.get(themeSelector)).toBe("light")
        nestedStore.set(globalSettings, { theme: "dark" })
        expect(rootStore.get(themeSelector)).toBe("light")
        expect(nestedStore.get(themeSelector)).toBe("dark")
        nestedStore.del(globalSettings)
        expect(rootStore.get(themeSelector)).toBe("light")
        expect(nestedStore.get(themeSelector)).toBe("light")
    })
})

describe("async selector", () => {
    test("re-evaluates when dependency changes (no subscribers)", async () => {
        const store1 = store()
        const countAtom = atom(1)
        let resolve = () => {}
        const asyncSelector1 = selector(get => {
            const count = get(countAtom)
            return new Promise<number>(r => {
                resolve = () => r(count)
            })
        })

        // Initial get returns a promise
        const p1 = store1.get(asyncSelector1)
        expect(p1).toBeInstanceOf(Promise)
        resolve()
        expect(await p1).toBe(1)
        expect(store1.get(asyncSelector1)).toBe(1)

        // Change dependency — should re-evaluate and return new promise
        store1.set(countAtom, 2)
        const p2 = store1.get(asyncSelector1)
        expect(p2).toBeInstanceOf(Promise)
        resolve()
        expect(await p2).toBe(2)
        expect(store1.get(asyncSelector1)).toBe(2)
    })

    test("subscribed async selector re-evaluates when dependency changes", async () => {
        const store1 = store()
        const countAtom = atom(1)
        let evalCount = 0
        let resolve = () => {}
        const asyncSelector1 = selector(get => {
            const count = get(countAtom)
            evalCount++
            return new Promise<number>(r => {
                resolve = () => r(count)
            })
        })

        const callback = mock(() => {})
        store1.sub(asyncSelector1, callback)

        // Resolve initial promise
        resolve()
        await new Promise(r => setTimeout(r, 0))
        expect(store1.get(asyncSelector1)).toBe(1)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(evalCount).toBe(1)

        // Change dependency — selector should be re-evaluated
        store1.set(countAtom, 2)
        // The selector should have been re-evaluated by propagation
        expect(evalCount).toBe(2)

        // The value should now be a new promise
        const val = store1.get(asyncSelector1)
        expect(val).toBeInstanceOf(Promise)

        // Resolve the new promise
        resolve()
        await new Promise(r => setTimeout(r, 0))
        expect(store1.get(asyncSelector1)).toBe(2)
        // 3 notifications: (1) initial resolve, (2) dep change → new promise, (3) new promise resolves
        expect(callback).toHaveBeenCalledTimes(3)
    })

    test("re-evaluation of async selector sets up .then() handler", async () => {
        const store1 = store()
        const countAtom = atom(1)
        let resolve = () => {}
        const asyncSelector1 = selector(get => {
            const count = get(countAtom)
            return new Promise<number>(r => {
                resolve = () => r(count)
            })
        })

        // Subscribe to trigger propagation path
        store1.sub(asyncSelector1, () => {})

        // Resolve initial
        resolve()
        await new Promise(r => setTimeout(r, 0))
        expect(store1.get(asyncSelector1)).toBe(1)

        // Change dependency — propagation should re-evaluate and set up .then()
        store1.set(countAtom, 2)
        resolve()
        await new Promise(r => setTimeout(r, 0))

        // After the new promise resolves, value should be updated automatically
        expect(store1.get(asyncSelector1)).toBe(2)
    })

    test("pending async selector re-evaluates on dependency change", async () => {
        const store1 = store()
        const countAtom = atom(1)
        let evalCount = 0
        let resolve = (_v: number) => {}
        const asyncSelector1 = selector(get => {
            const count = get(countAtom)
            evalCount++
            return new Promise<number>(r => {
                resolve = v => r(v)
            })
        })

        // Subscribe so propagation re-evaluates
        store1.sub(asyncSelector1, () => {})
        expect(evalCount).toBe(1)

        // Value is currently a pending promise
        expect(store1.get(asyncSelector1)).toBeInstanceOf(Promise)

        // Change dependency while promise is still pending
        store1.set(countAtom, 2)
        // The selector should have been re-evaluated during propagation
        expect(evalCount).toBe(2)
    })

    test("stale promise resolution does not overwrite newer value", async () => {
        const store1 = store()
        const countAtom = atom(1)
        const resolvers: ((v: number) => void)[] = []
        let evalCount = 0
        const asyncSelector1 = selector(get => {
            const count = get(countAtom)
            evalCount++
            return new Promise<number>(r => {
                resolvers.push(v => r(v))
            })
        })

        // Subscribe so propagation re-evaluates
        store1.sub(asyncSelector1, () => {})
        expect(evalCount).toBe(1)

        // Change dependency before first promise resolves — should create new promise
        store1.set(countAtom, 2)
        expect(evalCount).toBe(2)
        expect(resolvers).toHaveLength(2)

        // Resolve the SECOND (current) promise first
        resolvers[1]!(2)
        await new Promise(r => setTimeout(r, 0))
        expect(store1.get(asyncSelector1)).toBe(2)

        // Now resolve the FIRST (stale) promise — should NOT overwrite
        resolvers[0]!(1)
        await new Promise(r => setTimeout(r, 0))
        expect(store1.get(asyncSelector1)).toBe(2)
    })

    test("get() re-evaluates after dependency changes while promise is pending", async () => {
        const store1 = store()
        const countAtom = atom(0)
        const resolvers: (() => void)[] = []
        const asyncSelector1 = selector(get => {
            const count = get(countAtom)
            return new Promise<number>(r => {
                resolvers.push(() => r(count))
            })
        })

        // Initial get returns a pending promise
        store1.get(asyncSelector1)
        expect(resolvers).toHaveLength(1)

        // Change dependency BEFORE resolving the first promise
        store1.set(countAtom, 1)

        // Resolve the first (now stale) promise
        resolvers[0]!()
        await new Promise(r => setTimeout(r, 0))

        // get() should re-evaluate with the new dependency value, not return stale 0
        const p2 = store1.get(asyncSelector1)
        expect(p2).toBeInstanceOf(Promise)
        resolvers[1]!()
        expect(await p2).toBe(1)
    })

    test("subscriber is notified when async selector resolves", async () => {
        const store1 = store()
        const asyncSelector1 = selector(
            () => new Promise<string>(r => setTimeout(() => r("done"), 5)),
        )

        const callback = mock(() => {})
        store1.sub(asyncSelector1, callback)

        // Initially the value is a promise
        expect(store1.get(asyncSelector1)).toBeInstanceOf(Promise)
        expect(callback).toHaveBeenCalledTimes(0)

        // Wait for resolution
        await wait(10)
        expect(store1.get(asyncSelector1)).toBe("done")
        expect(callback).toHaveBeenCalledTimes(1)
    })

    describe("deep selector chains", () => {
        // 200 levels is the previous test depth (which exercised the old
        // trampoline). It's deep enough to prove non-trivial chains work
        // and shallow enough to fit comfortably inside the JS stack on all
        // engines we care about.
        const DEEP = 200

        test("initializes a deep chain via get()", () => {
            const store1 = store()
            const base = atom(42)
            const chain: any[] = [base]
            for (let i = 0; i < DEEP; i++) {
                const prev = chain[i]
                chain.push(selector(get => get(prev)))
            }
            expect(store1.get(chain[DEEP])).toBe(42)
        })

        test("propagates updates through a deep chain via sub() and set()", () => {
            const store1 = store()
            const base = atom(0)
            const chain: any[] = [base]
            for (let i = 0; i < DEEP; i++) {
                const prev = chain[i]
                chain.push(selector(get => get(prev)))
            }
            const callback = mock(() => {})
            const unsub = store1.sub(chain[DEEP], callback)
            expect(store1.get(chain[DEEP])).toBe(0)

            store1.set(base, 7)
            expect(callback).toHaveBeenCalledTimes(1)
            expect(store1.get(chain[DEEP])).toBe(7)
            unsub()
        })

        test("chains beyond stack capacity throw, matching jotai", () => {
            // Discover a chain depth that the JS stack genuinely can't hold,
            // by finding the trivial-call ceiling and scaling past it. Selector
            // init burns far more frames per level than a trivial recursive
            // call, so 2x trivial ceiling is a comfortable overshoot. The cap
            // keeps the test cheap on engines with segmented stacks (e.g. JSC
            // can hit 50k+); 10k selectors is still well past selector init's
            // overflow point on every engine we care about. The exact error
            // class doesn't matter (raw RangeError vs SelectorEvaluationError
            // wrap) — the contract is that we throw rather than silently
            // truncating or hanging.
            const getMaxDepth = (): number => {
                let depth = 0
                const d = (): number => {
                    ++depth
                    try { return d() } catch { return depth }
                }
                return d()
            }
            const overflowDepth = Math.min(getMaxDepth() * 2, 10_000)
            const store1 = store()
            const base = atom(0)
            const chain: any[] = [base]
            for (let i = 0; i < overflowDepth; i++) {
                const prev = chain[i]
                chain.push(selector(get => get(prev)))
            }
            expect(() => store1.get(chain[overflowDepth])).toThrow()
        }, 10_000)
    })
})
