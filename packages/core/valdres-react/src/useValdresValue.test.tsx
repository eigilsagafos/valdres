import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { useValdresValue } from "./useValdresValue"
import {
    atom,
    atomFamily,
    getDefaultStore,
    selector,
    selectorFamily,
} from "valdres"

describe("useValdresValue", () => {
    test("atom", () => {
        const numberAtom = atom(10)
        const { result } = renderHook(() => useValdresValue(numberAtom))
        expect(result.current).toBe(10)
        const store = getDefaultStore()
        store.set(numberAtom, 20)
        expect(result.current).toBe(20)
    })

    test("selector", () => {
        const numberAtom = atom(10)
        const doubleSelector = selector(get => get(numberAtom) * 2)
        const { result } = renderHook(() => useValdresValue(doubleSelector))
        expect(result.current).toBe(20)
        const store = getDefaultStore()
        store.set(numberAtom, 20)
        expect(result.current).toBe(40)
    })

    test("selectorFamily", () => {
        const numberAtom = atom(10)
        const multiply = selectorFamily(
            number => get => get(numberAtom) * number,
        )
        const { result } = renderHook(() => useValdresValue(multiply(10)))
        expect(result.current).toBe(100)
        const store = getDefaultStore()
        store.set(numberAtom, 20)
        expect(result.current).toBe(200)
    })

    test("atomFamily", async () => {
        const family = atomFamily(1)
        const atom = family("1")
        const { result } = renderHook(() => useValdresValue(atom))
        expect(result.current).toBe(1)
        const store = getDefaultStore()
        store.set(atom, 2)
        expect(result.current).toBe(2)
        store.txn(set => {
            set(atom, 3)
            set(atom, 4)
        })
        expect(result.current).toBe(4)
    })
})
