import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { createStore } from "valdres"
import { useStoreId } from "./useStoreId"
import { Provider } from "./Provider"

describe("Provider", () => {
    test("set with direct value", () => {
        const store = createStore("Foo")

        const { result } = renderHook(() => useStoreId(), {
            wrapper: ({ children }) => (
                <Provider store={store}>{children}</Provider>
            ),
        })
        expect(result.current).toBe("Foo")
    })
})
