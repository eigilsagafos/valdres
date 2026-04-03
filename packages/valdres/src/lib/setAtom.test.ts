import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { setAtom } from "./setAtom"
import { selector } from "../selector"

describe("setAtom", () => {
    test("set with direct value", () => {
        const store1 = store()
        const numberAtom = atom(1)
        expect(store1.data.values.get(numberAtom)).toBeUndefined()
        setAtom(numberAtom, 2, store1.data)
        expect(store1.data.values.get(numberAtom)).toBe(2)
    })

    test("set with callback", () => {
        const store1 = store()
        const numberAtom = atom(1)
        expect(store1.data.values.get(numberAtom)).toBeUndefined()
        setAtom(numberAtom, current => current + 1, store1.data)
        expect(store1.data.values.get(numberAtom)).toBe(2)
    })

    test("set returns the new value", () => {
        const store1 = store()
        const numberAtom = atom(1)
        const returnedValue = setAtom(
            numberAtom,
            current => current + 1,
            store1.data,
        )
        expect(returnedValue).toBe(2)
    })

    test("set with same value does not trigger selectors and subscribers to re-evalute", () => {
        const store1 = store()
        const numberAtom = atom(1)
        const selectorCallback = mock(get => get(numberAtom) + 1)
        const multiplySelector = selector(selectorCallback)
        expect(store1.get(multiplySelector)).toBe(2)
        expect(selectorCallback).toHaveBeenCalledTimes(1)
        store1.set(numberAtom, 1)
        expect(selectorCallback).toHaveBeenCalledTimes(1)
        expect(store1.get(multiplySelector)).toBe(2)
        expect(selectorCallback).toHaveBeenCalledTimes(2) // this could be 1 if we optimize, getting the multiplySelector wrongly triggers a re eval
    })

    test("check deep freeze", () => {
        const defaultStore = store()
        const postAtom = atom({ tags: ["tag1"] })
        const post = defaultStore.get(postAtom)
        expect(post.tags).toEqual(["tag1"])
        expect(() => post.tags.push("tag2")).toThrowError(
            "Attempted to assign to readonly property",
        )
    })

    test("deep freeze applies to function values with properties", () => {
        const defaultStore = store()
        const fn = () => "hello"
        ;(fn as any).count = 0
        // Wrap in factory to store the function itself (not call it)
        const fnAtom = atom(() => fn)
        const val = defaultStore.get(fnAtom) as any
        expect(val()).toBe("hello")
        // Functions with own properties should be frozen in dev mode,
        // preventing mutation of their attached state.
        expect(() => { val.count = 1 }).toThrowError(
            "Attempted to assign to readonly property",
        )
    })
})
