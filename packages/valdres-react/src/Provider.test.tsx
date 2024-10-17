import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom, store } from "valdres"
import { useStoreId } from "./useStoreId"
import { Provider } from "./Provider"
import { useStore } from "./useStore"

const StoreId = () => {
    const id = useStoreId()
    return <div>{id}</div>
}

describe("Provider", () => {
    test("set with direct value", () => {
        const store1 = store("Foo")

        const { result } = renderHook(() => useStoreId(), {
            wrapper: ({ children }) => (
                <Provider store={store1}>{children}</Provider>
            ),
        })
        expect(result.current).toBe("Foo")
    })

    test("nested providers can access parent stores by id", () => {
        const storeA = store("A")
        const storeB = store("B")
        const storeC = store("C")

        const { result, rerender } = renderHook(
            (storeId?: string) => useStore(storeId),
            {
                wrapper: ({ children }) => (
                    <Provider store={storeA}>
                        <StoreId />
                        <Provider store={storeB}>
                            <StoreId />
                            <Provider store={storeC}>
                                <StoreId />
                                {children}
                            </Provider>
                        </Provider>
                    </Provider>
                ),
            },
        )
        expect(result.current.data.id).toBe("C")
        rerender("A")
        expect(result.current.data.id).toBe("A")
        rerender("B")
        expect(result.current.data.id).toBe("B")
        rerender("C")
        expect(result.current.data.id).toBe("C")
    })

    test("global atom works as expected when initializing store", () => {
        const storeA = store("A")
        const storeB = store("B")
        const userIds = atom<number[]>([], { global: true })

        renderHook((storeId?: string) => useStore(storeId), {
            wrapper: ({ children }) => (
                <Provider store={storeA}>
                    <StoreId />
                    <Provider
                        store={storeB}
                        initialize={() => [[userIds, [1, 2, 3]]]}
                    >
                        <StoreId />
                        {children}
                    </Provider>
                </Provider>
            ),
        })

        expect(storeA.get(userIds)).toStrictEqual([1, 2, 3])
        expect(storeB.get(userIds)).toStrictEqual([1, 2, 3])
    })
})
