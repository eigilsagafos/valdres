import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { useStore } from "./useStore"
import { Provider } from "./Provider"
import { createStore } from "valdres"

describe("useStore", () => {
    test("defaultStore", () => {
        const { result } = renderHook(() => useStore())
        expect(result.current.data.id).toBe("default")
    })

    test("Provider", () => {
        const store = createStore()
        const { result } = renderHook(() => useStore(), {
            // @ts-ignore
            wrapper: ({ children }) => (
                <Provider store={store}>{children}</Provider>
            ),
        })
        expect(result.current.data.id).toBe(store.data.id)
    })
})
