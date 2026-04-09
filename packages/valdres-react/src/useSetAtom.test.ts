import { describe, test, expect } from "bun:test"
import { atom } from "valdres"
import { useSetAtom } from "./useSetAtom"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"

describe("useSetAtom", () => {
    test("default", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom(10)
        const { result } = renderHook(() => useSetAtom(numberAtom))
        expect(store.get(numberAtom)).toBe(10)
        result.current(20)
        expect(store.get(numberAtom)).toBe(20)
    })

    test("updates callback when atom reference changes", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const atomA = atom(1)
        const atomB = atom(2)
        let currentAtom = atomA
        const { result, rerender } = renderHook(() => useSetAtom(currentAtom))

        // Set atomA to 10
        result.current(10)
        expect(store.get(atomA)).toBe(10)
        expect(store.get(atomB)).toBe(2)

        // Switch to atomB and rerender
        currentAtom = atomB
        rerender()

        // Should set atomB, not atomA
        result.current(20)
        expect(store.get(atomB)).toBe(20)
        expect(store.get(atomA)).toBe(10)
    })
})
