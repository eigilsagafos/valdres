import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { Provider } from "./Provider"
import { createStore } from "valdres"
import { useStoreId } from "./useStoreId"

describe("useStoreId", () => {
    test("defaultStore", () => {
        const { result } = renderHook(() => useStoreId())
        expect(result.current).toBe("default")
    })

    test("Provider", () => {
        const store = createStore()
        const { result } = renderHook(() => useStoreId(), {
            // @ts-ignore
            wrapper: ({ children }) => (
                <Provider store={store}>{children}</Provider>
            ),
        })
        expect(result.current).toBe(store.data.id)
    })
})
