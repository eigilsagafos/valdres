import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import type { ReactElement } from "react"
import { atom, store, type Store } from "valdres"
import { Provider } from "./Provider"
import { useStore } from "./useStore"

afterEach(cleanup)

const StoreReader = ({
    observe,
}: {
    readonly observe: (store: Store) => void
}): ReactElement | null => {
    observe(useStore())
    return null
}

describe("Provider", () => {
    test("borrows the exact Store and follows store prop replacement", () => {
        const first = store()
        const second = store()
        const observed: Store[] = []
        const observe = (current: Store) => observed.push(current)
        const view = render(
            <Provider store={first}>
                <StoreReader observe={observe} />
            </Provider>,
        )

        expect(observed.at(-1)).toBe(first)

        view.rerender(
            <Provider store={second}>
                <StoreReader observe={observe} />
            </Provider>,
        )

        expect(observed.at(-1)).toBe(second)
    })

    test("does not dispose the borrowed Store on unmount", () => {
        const count = atom(0)
        const borrowedStore = store()
        const view = render(
            <Provider store={borrowedStore}>
                <div />
            </Provider>,
        )

        view.unmount()
        borrowedStore.set(count, 1)

        expect(borrowedStore.get(count)).toBe(1)
    })

    test("rejects a value that is not a Store before rendering children", () => {
        expect(() =>
            render(
                <Provider store={{} as Store}>
                    <div />
                </Provider>,
            ),
        ).toThrow()
    })
})
