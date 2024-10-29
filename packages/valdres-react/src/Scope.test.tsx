import { describe, test, expect } from "bun:test"
import { render } from "@testing-library/react"
import { atom, store, type Atom } from "valdres"
import { Provider } from "./Provider"
import { Scope } from "./Scope"
import { useSetAtom } from "./useSetAtom"
import { useValue } from "./useValue"

const SetAtom = ({ atom, value, ...rest }) => {
    const set = useSetAtom(atom)
    return <button {...rest} onClick={() => set(value)}></button>
}

const AtomValue = <T extends any>({ atom, ...rest }: { atom: Atom<T> }) => {
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
        await res.unmount()
    })

    test("scope is released on unmount", async () => {
        const rootStore = store()
        const res = render(
            <Provider store={rootStore}>
                <Scope scopeId="Foo" />
            </Provider>,
        )
        expect(Object.keys(rootStore.data.scopes)).toStrictEqual(["Foo"])
        await res.unmount()
        expect(Object.keys(rootStore.data.scopes)).toStrictEqual([])
    })

    test("Scope with initialize", async () => {
        const rootStore = store()
        const atom1 = atom(1)
        const atom2 = atom(2)
        const atom3 = atom(3)
        const res = render(
            <Provider store={rootStore}>
                <Scope
                    scopeId="Foo"
                    initialize={() => [
                        [atom1, 4],
                        [atom2, 5],
                        [atom3, 6],
                    ]}
                >
                    <AtomValue atom={atom1} data-testid="value1" />
                    <AtomValue atom={atom2} data-testid="value2" />
                    <AtomValue atom={atom3} data-testid="value3" />
                </Scope>
            </Provider>,
        )
        const value1 = await res.findByTestId("value1")
        expect(value1.innerText).toBe("4")
        const value2 = await res.findByTestId("value2")
        expect(value2.innerText).toBe("5")
        const value3 = await res.findByTestId("value3")
        expect(value3.innerText).toBe("6")
        await res.unmount()
    })

    test("Scope with initialize cb", async () => {
        const rootStore = store()
        const atom1 = atom(1)
        const res = render(
            <Provider store={rootStore}>
                <Scope
                    scopeId="Foo"
                    initialize={txn => {
                        txn.set(atom1, 2)
                    }}
                >
                    <AtomValue atom={atom1} data-testid="value1" />
                </Scope>
            </Provider>,
        )
        const value1 = await res.findByTestId("value1")
        expect(value1.innerText).toBe("2")
        await res.unmount()
    })

    test("Scope with initialize cb called once", async () => {
        const rootStore = store()
        const numberAtom = atom(1)
        const Comp = () => {
            const value = useValue(numberAtom)
            return (
                <>
                    <div data-testid="valueRoot">{value}</div>
                    <Scope
                        scopeId="Foo"
                        initialize={txn => {
                            txn.set(numberAtom, curr => curr + 1)
                        }}
                    >
                        <AtomValue
                            atom={numberAtom}
                            data-testid="valueScoped"
                        />
                    </Scope>
                </>
            )
        }
        const res = render(
            <Provider store={rootStore}>
                <Comp></Comp>
            </Provider>,
        )
        const valueRoot1 = await res.findByTestId("valueRoot")
        expect(valueRoot1.innerText).toBe("1")
        const valueScoped1 = await res.findByTestId("valueScoped")
        expect(valueScoped1.innerText).toBe("2")
        rootStore.set(numberAtom, 0)
        const valueRoot2 = await res.findByTestId("valueRoot")
        expect(valueRoot2.innerText).toBe("0")
        const valueScoped2 = await res.findByTestId("valueScoped")
        expect(valueScoped2.innerText).toBe("2")
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
