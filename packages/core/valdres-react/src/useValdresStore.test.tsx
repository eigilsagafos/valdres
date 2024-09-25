import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { useValdresStore } from "./useValdresStore"
import { ValdresProvider } from "./ValdresProvider"
import { createStore } from "valdres"

describe("useValdresStore", () => {
    test("defaultStore", () => {
        const { result } = renderHook(() => useValdresStore())
        expect(result.current.data.id).toBe("default")
    })

    test("ValdresProvider", () => {
        const store = createStore()
        const { result } = renderHook(() => useValdresStore(), {
            // @ts-ignore
            wrapper: ({ children }) => (
                <ValdresProvider store={store}>{children}</ValdresProvider>
            ),
        })
        expect(result.current.data.id).toBe(store.data.id)
    })
})
