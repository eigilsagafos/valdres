import { render, act } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import { Suspense } from "react"
import { atom, selector, store } from "valdres"
import { Provider } from "../src/Provider"
import { useValue } from "../src/useValue"

/**
 * `atom.mdx` claims "In React, async atoms work seamlessly with `Suspense`",
 * and `useValue` throws a promise-like snapshot to make that work — but nothing
 * covered it. Pin it here, on a `batchUpdates` store, because reading the
 * COMMITTED value is what now feeds that throw.
 *
 * An async atom is a FUNCTION default value (`atom(async () => …)`). Its pending
 * promise is replaced by the resolved value once it settles, which is what lets
 * the retry after Suspense return a real value instead of throwing again.
 */
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve))

describe("async atoms suspend and resolve under batchUpdates", () => {
    test("an async atom renders its resolved value", async () => {
        const dataAtom = atom(async () => 7, { name: "suspenseAtom" })
        const testStore = store({ batchUpdates: true })
        let renders = 0

        const Reader = () => {
            const value = useValue(dataAtom)
            renders++
            return <div>value: {value}</div>
        }

        let container: HTMLElement
        await act(async () => {
            container = render(
                <Provider store={testStore}>
                    <Suspense fallback={<div>loading</div>}>
                        <Reader />
                    </Suspense>
                </Provider>,
            ).container
        })
        await act(async () => {
            for (let i = 0; i < 20; i++) await tick()
        })

        expect(container!.textContent).toBe("value: 7")
        // A snapshot that kept handing back a promise would re-suspend forever;
        // one successful render is the whole point.
        expect(renders).toBe(1)
        testStore.dispose()
    })

    test("a selector over an async atom resolves too", async () => {
        const dataAtom = atom(async () => 21, { name: "suspenseSource" })
        const doubled = selector(get => (get(dataAtom) as number) * 2, {
            name: "suspenseDoubled",
        })
        const testStore = store({ batchUpdates: true })

        const Reader = () => <div>value: {useValue(doubled)}</div>

        let container: HTMLElement
        await act(async () => {
            container = render(
                <Provider store={testStore}>
                    <Suspense fallback={<div>loading</div>}>
                        <Reader />
                    </Suspense>
                </Provider>,
            ).container
        })
        await act(async () => {
            for (let i = 0; i < 20; i++) await tick()
        })

        expect(container!.textContent).toBe("value: 42")
        testStore.dispose()
    })
})
