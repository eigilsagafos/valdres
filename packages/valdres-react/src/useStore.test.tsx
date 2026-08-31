import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { store } from "valdres"
import { Provider } from "./Provider"
import { useStore } from "./useStore"

afterEach(cleanup)

describe("useStore", () => {
    test("returns the nearest Provider Store", () => {
        const outer = store()
        const inner = store()
        const { result } = renderHook(() => useStore(), {
            wrapper: ({ children }: { readonly children: ReactNode }) => (
                <Provider store={outer}>
                    <Provider store={inner}>{children}</Provider>
                </Provider>
            ),
        })

        expect(result.current).toBe(inner)
    })

    test("throws when there is no Provider", () => {
        expect(() => renderHook(() => useStore())).toThrow(
            "valdres-react: no Store was provided",
        )
    })
})
