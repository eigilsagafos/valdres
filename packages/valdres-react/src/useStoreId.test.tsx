import { describe, test, expect } from "bun:test"
import { useStoreId } from "./useStoreId"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"
import { renderHook, suppressErrorOutput } from "@testing-library/react-hooks"

describe("useStoreId", () => {
    test("Provider", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const { result } = renderHook(() => useStoreId())
        expect(result.current).toBe(store.data.id)
    })

    test("Error when no <Provider>", () => {
        const restore = suppressErrorOutput()
        const { result } = renderHook(() => useStoreId())
        expect(result.error?.message).toBe(
            "No valdres store found. Make sure you wrap your code in a <Provider>",
        )
        restore()
    })
})
