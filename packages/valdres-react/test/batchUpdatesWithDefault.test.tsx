import { describe, test, expect } from "bun:test"
import { atom } from "valdres"
import { generateStoreAndRenderHook } from "./generateStoreAndRenderHook"
import { useValdresValueWithDefault } from "../src/useValdresValueWithDefault"

describe("batchUpdates with useValdresValueWithDefault", () => {
    test("set before render: component sees set value, not default", () => {
        const numberAtom = atom<number>()
        const [store, renderHook] = generateStoreAndRenderHook()

        // Set the atom before rendering the component that uses withDefault
        store.set(numberAtom, 42)

        const { result, rerender } = renderHook(() =>
            useValdresValueWithDefault(numberAtom, 0),
        )
        // Should see 42 (the set value), not 0 (the default)
        // This might require the microtask to flush first
        rerender()
        expect(result.current).toBe(42)
    })

    test("render with default then set: component updates correctly", () => {
        const numberAtom = atom<number>()
        const [store, renderHook] = generateStoreAndRenderHook()

        const { result, rerender } = renderHook(() =>
            useValdresValueWithDefault(numberAtom, 0),
        )
        // Initially sees the default
        expect(result.current).toBe(0)

        // Set the atom
        store.set(numberAtom, 42)
        rerender()
        expect(result.current).toBe(42)
    })
})
