import { describe, test, expect } from "bun:test"
import { useStoreId } from "./useStoreId"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"

describe("useStoreId", () => {
    test("Provider", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const { result } = renderHook(() => useStoreId())
        expect(result.current).toBe(store.data.id)
    })
})
