import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { render } from "@testing-library/react"
import { atom, store, type Atom } from "valdres"
import { useStoreId } from "./useStoreId"
import { Provider } from "./Provider"
import { useStore } from "./useStore"
import { Scope } from "./Scope"
import { useSetAtom } from "./useSetAtom"
import { useValue } from "./useValue"

const StoreId = () => {
    const id = useStoreId()
    return <div>{id}</div>
}

const SetAtom = ({ atom, value, ...rest }) => {
    const set = useSetAtom(atom)
    return <button {...rest} onClick={() => set(value)}></button>
}

const AtomValue = ({ atom, ...rest }: { atom: Atom<string> }) => {
    const value = useValue(atom)
    return <div {...rest}>{value}</div>
}

describe("Scope", () => {
    test("state flows though from parent store until set in scope", async () => {
        const rootStore = store()
        const nameAtom = atom("default")
        const res = render(
            <Provider store={rootStore}>
                <Scope scopeId="Foo">
                    <AtomValue atom={nameAtom} data-testid="value" />
                </Scope>
            </Provider>,
        )

        const value1 = await res.findByTestId("value")
        expect(value1.innerText).toBe("default")
        rootStore.set(nameAtom, "root")
        const value2 = await res.findByTestId("value")
        expect(value2.innerText).toBe("root")
        const scopedStore = rootStore.scope("Foo")
        scopedStore.set(nameAtom, "scoped")
        const value3 = await res.findByTestId("value")
        expect(value3.innerText).toBe("scoped")
    })

    test.only("scope is released on unmount", async () => {
        const rootStore = store()
        const res = render(
            <Provider store={rootStore}>
                <Scope scopeId="Foo" />
            </Provider>,
        )

        await res.unmount()
    })

    test.todo("nested providers can access parent stores by id", async () => {
        const store1 = store()
        const atom1 = atom("root")

        // store1.get(atom1, "scope1")
        // store1
        const res = render(
            <Provider store={store1}>
                <Scope scopeId="Foo">
                    {/* <div data-testid={"a"}>
                        <CurrentScopeId />
                    </div> */}
                    <AtomValue atom={atom1} data-testid="valueA" />
                    <SetAtom
                        atom={atom1}
                        value={"In Foo"}
                        data-testid="buttonA"
                    />
                </Scope>
                <Scope scopeId="Bar">
                    {/* <div data-testid={"b"}>
                        <CurrentScopeId />
                    </div> */}
                    <AtomValue atom={atom1} data-testid="valueB" />
                    <SetAtom
                        atom={atom1}
                        value={"In Bar"}
                        data-testid="buttonB"
                    />
                </Scope>
            </Provider>,
        )

        const FooStore = store1.data.scopes.Foo
        expect(FooStore.values.get(atom1)).toBeUndefined()
        const divA = await res.findByTestId("a")
        expect(divA.innerText).toBe("Foo")
        const valueA = await res.findByTestId("valueA")
        expect(valueA.innerText).toBe("root")
        const buttonA = await res.findByTestId("buttonA")
        buttonA.click()
        // console.log(FooStore.values.get(atom1))
        const valueA2 = await res.findByTestId("valueA")
        expect(valueA2.innerText).toBe("In Foo")
        const BarStore = store1.data.scopes.Bar
        console.log(store1.data.scopes.Foo.values.get(atom1))
        console.log(store1.data.scopes.Bar.values.get(atom1))
        // store1.data
        // const divB = await res.findByTestId("b")
        // expect(divB.innerText).toBe("Bar")
        // const valueB = await res.findByTestId("valueB")
        // expect(valueB.innerText).toBe("root")

        await res.unmount()

        // const buttonB = await res.findByTestId("buttonB")
        // buttonB.click()
        // const valueB2 = await res.findByTestId("valueB")
        // expect(valueB2.innerText).toBe("In Bar")

        // const { result, rerender, ...rest } = renderHook(
        //     (storeId?: string) => useScopeId(),
        //     {
        //         wrapper: ({ children }) => (
        //             <Provider store={store1}>
        //                 <Scope scopeId="Foo">{children}</Scope>
        //                 <Scope scopeId="Bar">{children}</Scope>
        //             </Provider>
        //         ),
        //     },
        // )
        // console.log(result.current)
        // expect(result.current.data.id).toBe("C")
        // rerender("A")
        // expect(result.current.data.id).toBe("A")
        // rerender("B")
        // expect(result.current.data.id).toBe("B")
        // rerender("C")
        // expect(result.current.data.id).toBe("C")
    })

    // test("global atom works as expected when initializing store", () => {
    //     const storeA = store("A")
    //     const storeB = store("B")
    //     const userIds = atom<number[]>([], { global: true })

    //     renderHook((storeId?: string) => useStore(storeId), {
    //         wrapper: ({ children }) => (
    //             <Provider store={storeA}>
    //                 <StoreId />
    //                 <Provider
    //                     store={storeB}
    //                     initialize={() => [[userIds, [1, 2, 3]]]}
    //                 >
    //                     <StoreId />
    //                     {children}
    //                 </Provider>
    //             </Provider>
    //         ),
    //     })

    //     expect(storeA.get(userIds)).toStrictEqual([1, 2, 3])
    //     expect(storeB.get(userIds)).toStrictEqual([1, 2, 3])
    // })
})
