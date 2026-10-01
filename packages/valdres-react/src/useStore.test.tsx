import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { store, type Store } from "valdres"
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

    test("prefers an explicit Store over the nearest Provider, and needs no Provider for it", () => {
        const provided = store()
        const explicit = store()
        const underProvider = renderHook(() => useStore(explicit), {
            wrapper: ({ children }: { readonly children: ReactNode }) => (
                <Provider store={provided}>{children}</Provider>
            ),
        })
        expect(underProvider.result.current).toBe(explicit)
        const withoutProvider = renderHook(() => useStore(explicit))
        expect(withoutProvider.result.current).toBe(explicit)
        const fallback = renderHook(() => useStore(undefined), {
            wrapper: ({ children }: { readonly children: ReactNode }) => (
                <Provider store={provided}>{children}</Provider>
            ),
        })
        expect(fallback.result.current).toBe(provided)
    })

    test("rejects a value that is not a Store", () => {
        expect(() =>
            renderHook(() => useStore("legacy-id" as unknown as Store)),
        ).toThrow()
    })

    test("throws when there is no Provider", () => {
        expect(() => renderHook(() => useStore())).toThrow(
            "valdres-react: no Store was provided",
        )
    })
})
