import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { ValdresProvider } from "./ValdresProvider"
import { createStore } from "valdres"
import { useValdresStoreId } from "./useValdresStoreId"

describe("useValdresStoreId", () => {
    test("defaultStore", () => {
        const { result } = renderHook(() => useValdresStoreId())
        expect(result.current).toBe("default")
    })

    test("ValdresProvider", () => {
        const store = createStore()
        const { result } = renderHook(() => useValdresStoreId(), {
            // @ts-ignore
            wrapper: ({ children }) => (
                <ValdresProvider store={store}>{children}</ValdresProvider>
            ),
        })
        expect(result.current).toBe(store.data.id)
    })
})
