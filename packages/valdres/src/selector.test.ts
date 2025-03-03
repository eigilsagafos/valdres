import { describe, expect, mock, test } from "bun:test"
import { equal } from "./lib/equal"
import { wait } from "../test/utils/wait"
import { atom } from "./atom"
import { atomFamily } from "./atomFamily"
import { createStoreWithSelectorSet } from "./createStoreWithSelectorSet"
import { selector } from "./selector"
import { store } from "./store"

describe("selector", () => {
    test("computations are cached", () => {
        const store1 = store()
        const numberAtom = atom(5)
        const callback = mock(get => get(numberAtom) * 100)
        const time100Selector = selector(callback)
        expect(store1.get(time100Selector)).toBe(500)
        expect(store1.get(time100Selector)).toBe(500)
        expect(store1.get(time100Selector)).toBe(500)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("selectors update", () => {
        const store1 = store()
        const numberAtom = atom(5)
        const callback = mock(get => get(numberAtom) * 100)
        const time100Selector = selector(callback, "times 100 selector")
        expect(store1.get(time100Selector)).toBe(500)
        expect(callback).toHaveBeenCalledTimes(1)
        store1.set(numberAtom, 10)
        expect(callback).toHaveBeenCalledTimes(1)
        // expect(store1.get(time100Selector)).toBe(1000)
        // expect(callback).toHaveBeenCalledTimes(2)
    })

    test("nested selectors update", () => {
        const store1 = store()
        const baseAtom = atom(10)
        const callbackLevel1 = mock(get => get(baseAtom) * 10)
        const selectorLevel1 = selector(callbackLevel1, `selectorLevel1`)
        const callbackLevel2 = mock(get => get(selectorLevel1) * 10)
        const selectorLevel2 = selector(callbackLevel2, `selectorLevel2`)
        expect(store1.get(selectorLevel1)).toBe(100)
        expect(store1.get(selectorLevel2)).toBe(1000)
        store1.set(baseAtom, 20)
        expect(store1.get(selectorLevel1)).toBe(200)
        expect(store1.get(selectorLevel2)).toBe(2000)
    })

    test("conditional nested selector subscriptions update", () => {
        const store1 = store()
        const boolAtom = atom(true, "bool")
        const atom1 = atom(1, "atom1")
        const atom2 = atom(2, "atom2")

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

        // // console.log(store1.subscribers.get(atom1))

        // const selectorLevel1 = selector(callbackLevel1, `selectorLevel1`)
        // const callbackLevel2 = mock(get => get(selectorLevel1) * 10)
        // const selectorLevel2 = selector(callbackLevel2, `selectorLevel2`)
        // expect(store1.get(selectorLevel1)).toBe(100)
        // expect(store1.get(selectorLevel2)).toBe(1000)
        // store1.set(baseAtom, 20)
        // expect(store1.get(selectorLevel1)).toBe(200)
        // expect(store1.get(selectorLevel2)).toBe(2000)
    })

    test("selector set bypass (used for compat moduels)", () => {
        const store1 = createStoreWithSelectorSet()
        const atom1 = atom(1)
        const atom2 = atom(2)
        const selector1 = selector(get => get(atom1))
        selector1.set = (set, get, reset, val1, val2) => {
            set(atom1, val1)
            set(atom2, val2)
        }

        const res = store1.set(selector1, 3, 4)
        expect(store1.get(atom1)).toBe(3)
        expect(store1.get(atom2)).toBe(4)
    })

    test("selector set bypass with async callback (used for compat moduels)", async () => {
        const store1 = createStoreWithSelectorSet()
        const atom1 = atom(1)
        const atom2 = atom(2)
        const selector1 = selector(get => get(atom1))
        selector1.set = async (set, get, reset, val1, val2) => {
            return wait(10).then(() => {
                set(atom1, val1)
                set(atom2, val2)
            })
        }

        const res = store1.set(selector1, 3, 4)
        await res
        expect(store1.get(atom1)).toBe(3)
        expect(store1.get(atom2)).toBe(4)
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
    //     console.log(store1.get(selector1))
    //     // await wait(10)
    //     // console.log(store1.get(selector1))
    // })

    test("selector with multiple async gets", async () => {
        const store1 = store()
        const asyncAtom1 = atom(() => wait(1).then(() => 1), "asyncAtom1")
        const asyncAtom2 = atom(() => wait(1).then(() => 2), "asyncAtom2")

        const selector1 = selector(get => {
            return [get(asyncAtom1), get(asyncAtom2)]
        })
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
    //     console.log(callbackLog)
    //     callbackLog = []
    //     store1.set(atom1, 2)
    //     console.log(callbackLog)
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
        const selector1 = selector(get => get(keysAtomFamily), "Selector1")
        const subCallback = mock(() => {})
        store1.sub(keysAtomFamily, subCallback)
        const res1 = store1.get(selector1)
        expect(res1).toStrictEqual(["a", "b"])
        expect(subCallback).toHaveBeenCalledTimes(0)
        store1.set(keysAtomFamily("d"), true)
        expect(subCallback).toHaveBeenCalledTimes(1)
        const res2 = store1.get(selector1)
        expect(res2).toStrictEqual(["a", "b", "d"])
        store1.set(keysAtomFamily("b"), false)
        const res3 = store1.get(selector1)
        // console.log(res3)
        // const allUsers = expect(store1.get(userAtomFamily)).toStrictEqual([
        //     [1, { name: "Foo" }],
        //     [2, { name: "Bar" }],
        //     [3, {}],
        // ])
    })

    test.skip("A selector that listens to a promise on an atom object", async () => {
        // WIP: Added this when running some of the jotai test suite. I'm not sure
        // if we should support this? One problem now is that Valdres's aggressive
        // approach to stop propagating changes if a value does not change was
        // blocking this test as deep equal on Promise returned true.
        const store1 = store()
        // const resolved: number[] = []
        const resolve: ((value: number) => void)[] = []
        equal(
            new Promise<number>(r => resolve.push(r)),
            new Promise<number>(r => resolve.push(r)),
        )
        const atom1 = atom({
            promise: new Promise<number>(r => resolve.push(r)),
        })

        const selector1 = selector(async get => {
            await Promise.resolve()
            return await get(atom1).promise
        })
        const res = store1.get(selector1)
        console.log(res)

        await new Promise(r => setTimeout(r))
        store1.set(atom1, {
            promise: new Promise<number>(r => resolve.push(r)),
            oter: "sd",
        })
        resolve[1](1)
        console.log(`res2`, resolve)
        // await wait(1)
        // await Promise.resolve()
        await new Promise(r => setTimeout(r))
        // await res
        const res2 = store1.get(selector1)
        console.log(`res2`, res2)
        console.log(
            `test1`,
            equal(
                new Promise<number>(r => resolve.push(r)),
                new Promise<number>(r => resolve.push(r)),
            ),
        )
        console.log(
            `test2`,
            equal(
                new Promise<number>(r => resolve.push(r)),
                new Promise<number>(r => {
                    resolve.push(r)
                    return "foo"
                }),
            ),
        )
        console.log(
            `test3`,
            Object.is(
                new Promise<number>(r => resolve.push(r)),
                new Promise<number>(r => resolve.push(r)),
            ),
        )

        // const asyncAtom = atom(async get => {
        //     // we want to pick up `syncAtom` as an async dep
        //     await Promise.resolve()
        //     return await get(syncAtom).promise
        // })
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
})
