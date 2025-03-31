import { describe, test, expect, mock } from "bun:test"
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
        const family = atomFamily<number, [string]>(0)
        const atom1 = family("1")
        const atom2 = family("2")
        const { result } = renderHook(() => useValue(family))
        expect(result.current).toStrictEqual([])
        store.get(atom1)
        // console.log(result.current)
        // // expect(result.current).toStrictEqual(["1"]) // TODO: This should work when correctly handled in valdres package...
        store.set(atom2, 2)
        expect(result.current).toStrictEqual([atom1, atom2])
    })

    test("nested selectors should only re-calculate when needed", () => {
        const atom1 = atom(1)
        const selector1cb = mock(get => {
            get(atom1)
            //We get the atom but we dont use the value
            return 1
        })
        const selector1 = selector(selector1cb)
        const selector2cb = mock(get => get(selector1) + 1)
        const selector2 = selector(selector2cb)
        const selector3cb = mock(get => get(selector2) + 1)
        const selector3 = selector(selector3cb)
        const [store, renderHook] = generateStoreAndRenderHook()
        const { result } = renderHook(() => [
            useValue(selector1),
            useValue(selector2),
            useValue(selector3),
        ])
        expect(result.current).toStrictEqual([1, 2, 3])
        expect(selector1cb).toHaveBeenCalledTimes(1)
        expect(selector2cb).toHaveBeenCalledTimes(1)
        expect(selector3cb).toHaveBeenCalledTimes(1)
        store.set(atom1, 2)
        expect(result.current).toStrictEqual([1, 2, 3])
        expect(selector1cb).toHaveBeenCalledTimes(2)
        expect(selector2cb).toHaveBeenCalledTimes(1)
        expect(selector3cb).toHaveBeenCalledTimes(1)
    })
})
