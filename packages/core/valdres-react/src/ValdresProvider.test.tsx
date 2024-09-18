import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { createStore } from "valdres"
import { useValdresStoreId } from "./useValdresStoreId"
import { ValdresProvider } from "./ValdresProvider"

describe("ValdresProvider", () => {
    test("set with direct value", () => {
        const store = createStore("Foo")

        const { result } = renderHook(() => useValdresStoreId(), {
            wrapper: ({ children }) => (
                <ValdresProvider store={store}>{children}</ValdresProvider>
            ),
        })
        expect(result.current).toBe("Foo")
    })
})
