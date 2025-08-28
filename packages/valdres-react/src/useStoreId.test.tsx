import { renderHook } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"
import { useStoreId } from "./useStoreId"

describe("useStoreId", () => {
    test("Provider", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const { result } = renderHook(() => useStoreId())
        expect(result.current).toBe(store.data.id)
    })

    test("Error when no <Provider>", () => {
        expect(() => {
            renderHook(() => useStoreId(), {})
        }).toThrowError(
            "No valdres store found. Make sure you wrap your code in a <Provider>",
        )
    })
})
