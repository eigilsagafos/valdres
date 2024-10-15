import { describe, test, expect } from "bun:test"
import { useResetAtom } from "./useResetAtom"
import { atom, atomFamily } from "valdres"
import { useAtom } from "./useAtom"
import { waitFor } from "@testing-library/react"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"

const useTestHook = atom => {
    const reset = useResetAtom(atom)
    const [value, set] = useAtom(atom)
    return {
        value,
        set,
        reset,
    }
}

describe("useResetAtom", () => {
    test("atom with primitive value", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom(10)
        const { result } = renderHook(() => useTestHook(numberAtom))
        expect(result.current.value).toBe(10)
        result.current.set(20)
        expect(result.current.value).toBe(20)
        result.current.reset()
        waitFor(() => {
            expect(result.current.value).toBe(10)
        })
    })

    test("atomFamily with callback", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const fam = atomFamily(arg => [arg])
        const atom1 = fam(10)
        const { result } = renderHook(() => useResetAtom(atom1))
        expect(store.get(atom1)).toStrictEqual([10])
        store.set(atom1, [20])
        expect(store.get(atom1)).toStrictEqual([20])
        result.current()
        expect(store.get(atom1)).toStrictEqual([10])
    })
})
