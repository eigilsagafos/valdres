import { describe, test, expect } from "bun:test"
import { useStore } from "./useStore"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"

describe("useStore", () => {
    test("Provider", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const { result } = renderHook(() => useStore())
        expect(result.current.data.id).toBe(store.data.id)
    })
})
