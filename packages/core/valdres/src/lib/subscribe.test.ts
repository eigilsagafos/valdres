import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"
import { transaction } from "./transaction"
import { selector } from "../selector"
import { atomFamily } from "../atomFamily"

describe("subscribe", () => {
    test("Subscribe to un-mounted atom", () => {
        const store = createStore()
        const atom1 = atom(1)
        const callback = mock(() => {})
        store.sub(atom1, callback)
        expect(callback).toHaveBeenCalledTimes(0)
        store.set(atom1, 2)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("Subscribe to un-mounted selector", () => {
        const store = createStore()
        const atom1 = atom([1, 2, 3])
        const selector1 = selector(get => {
            const [int1, int2, int3] = get(atom1)
            return int1 + int2 + int3
        })
        const callback = mock(() => {})
        store.sub(selector1, callback)
        expect(callback).toHaveBeenCalledTimes(0)
        store.set(atom1, [2, 1, 3])
        expect(callback).toHaveBeenCalledTimes(0)
        store.set(atom1, [3, 2, 1])
        expect(callback).toHaveBeenCalledTimes(0)
        store.set(atom1, [3, 2, 2])
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("subscription to selector with non-primitive value", () => {
        const store = createStore()
        const atom1 = atom(1)
        const selector1 = selector(get => get(atom1))
        const callback = mock(() => {})
        store.sub(selector1, callback)
        expect(callback).toHaveBeenCalledTimes(0)
        store.set(atom1, 2)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    // test("selector with non primitive value", () => {
    //     const store = createStore()
    //     const atom1 = atom(1)
    //     const selector1 = selector(get => [get(atom1)])
    //     const callback = () => console.log(`hi`)
    //     // sg
    //     store.get(selector1)
    //     store.sub(selector1, callback)
    //     store.sub(atom1, callback)

    //     store.set(atom1, 2)
    //     store.get(selector1)
    //     store.get(selector1)
    //     store.get(selector1)

    //     // transaction(set => {
    //     //     set(atom1, curr => curr + 1)
    //     // }, store.data)
    //     // expect(store.get(atom1)).toBe(2)
    // })
})
