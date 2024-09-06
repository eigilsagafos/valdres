import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { useResetValdresState } from "./useResetValdresState"
import { atom, atomFamily, getDefaultStore } from "@valdres/core"

describe("useResetValdresState", () => {
    test("atom with primitive value", () => {
        const store = getDefaultStore()
        const numberAtom = atom(10)
        const { result } = renderHook(() => useResetValdresState(numberAtom))
        expect(store.get(numberAtom)).toBe(10)
        store.set(numberAtom, 20)
        expect(store.get(numberAtom)).toBe(20)
        result.current()
        expect(store.get(numberAtom)).toBe(10)
    })

    test("atomFamily with callback", () => {
        const store = getDefaultStore()
        const fam = atomFamily(arg => [arg])
        const atom1 = fam(10)
        const { result } = renderHook(() => useResetValdresState(atom1))
        expect(store.get(atom1)).toStrictEqual([10])
        store.set(atom1, [20])
        expect(store.get(atom1)).toStrictEqual([20])
        result.current()
        expect(store.get(atom1)).toStrictEqual([10])
    })
})
