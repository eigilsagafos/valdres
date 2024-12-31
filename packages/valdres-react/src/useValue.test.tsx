import { describe, test, expect } from "bun:test"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"
import { useValue } from "./useValue"
import { atom, atomFamily, selector, selectorFamily } from "valdres"

describe("useValue", () => {
    test("atom", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom(10)
        const { result } = renderHook(() => useValue(numberAtom))
        expect(result.current).toBe(10)
        store.set(numberAtom, 20)
        expect(result.current).toBe(20)
    })

    test("selector", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom(10)
        const doubleSelector = selector(get => get(numberAtom) * 2)
        const { result } = renderHook(() => useValue(doubleSelector))
        expect(result.current).toBe(20)
        store.set(numberAtom, 20)
        expect(result.current).toBe(40)
    })

    test("selectorFamily", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom(10)
        const multiply = selectorFamily(
            number => get => get(numberAtom) * number,
        )
        const { result } = renderHook(() => useValue(multiply(10)))
        expect(result.current).toBe(100)
        store.set(numberAtom, 20)
        expect(result.current).toBe(200)
    })

    test("atomFamily", async () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const family = atomFamily(1)
        const atom = family("1")
        const { result } = renderHook(() => useValue(atom))
        expect(result.current).toBe(1)
        store.set(atom, 2)
        expect(result.current).toBe(2)
        store.txn(({ set }) => {
            set(atom, 3)
            set(atom, 4)
        })
        expect(result.current).toBe(4)
    })

    test("atomFamily id list", async () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const family = atomFamily<string, number>(0)
        const atom1 = family("1")
        const atom2 = family("2")
        const { result } = renderHook(() => useValue(family))
        expect(result.current).toStrictEqual([])
        store.get(atom1)
        // expect(result.current).toStrictEqual(["1"]) // TODO: This should work when correctly handled in valdres package...
        store.set(atom2, 2)
        expect(result.current).toStrictEqual(["1", "2"])
    })
})
