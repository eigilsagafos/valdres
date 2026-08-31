import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import type { ReactNode } from "react"
import { atom, selector, store, type Store } from "valdres"
import { Provider } from "./Provider"
import { useValue } from "./useValue"

afterEach(cleanup)

describe("useValue", () => {
    test("subscribes to atoms and synchronous selectors", () => {
        const count = atom(2)
        const doubled = selector(get => get(count) * 2)
        const selectedStore = store()
        const { result } = renderHook(
            () => [useValue(count), useValue(doubled)] as const,
            {
                wrapper: ({ children }: { readonly children: ReactNode }) => (
                    <Provider store={selectedStore}>{children}</Provider>
                ),
            },
        )

        expect(result.current).toEqual([2, 4])

        act(() => selectedStore.set(count, 3))

        expect(result.current).toEqual([3, 6])
    })

    test("accepts an explicit Store without a Provider", () => {
        const count = atom(1)
        const explicitStore = store()
        const { result } = renderHook(() => useValue(count, explicitStore))

        act(() => explicitStore.set(count, 2))

        expect(result.current).toBe(2)
    })

    test("always calls context before selecting an explicit Store", () => {
        const count = atom(0)
        const contextStore = store()
        const explicitStore = store()
        contextStore.set(count, 10)
        explicitStore.set(count, 20)

        const { result, rerender } = renderHook(
            ({ target }: { readonly target: Store | undefined }) =>
                useValue(count, target),
            {
                initialProps: { target: explicitStore as Store | undefined },
                wrapper: ({ children }: { readonly children: ReactNode }) => (
                    <Provider store={contextStore}>{children}</Provider>
                ),
            },
        )

        expect(result.current).toBe(20)

        rerender({ target: undefined })
        expect(result.current).toBe(10)

        act(() => explicitStore.set(count, 30))
        expect(result.current).toBe(10)

        act(() => contextStore.set(count, 40))
        expect(result.current).toBe(40)
    })

    test("uses the isolated hydration reader during server rendering", () => {
        const count = atom(7)
        const selectedStore = store()
        const Counter = () => <span>{useValue(count)}</span>

        const html = renderToString(
            <Provider store={selectedStore}>
                <Counter />
            </Provider>,
        )

        expect(html).toContain(">7</span>")
    })
})
