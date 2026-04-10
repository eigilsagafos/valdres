import { describe, test, expect } from "bun:test"
import { createRoot } from "solid-js"
import { atom, store as createStore } from "valdres"
import { ValdresProvider } from "./ValdresProvider"
import { ValdresScope } from "./ValdresScope"
import { createValue } from "./createValue"
import { useStore } from "./useStore"

describe("ValdresScope", () => {
    test("throws without provider", () => {
        expect(() => {
            createRoot(dispose => {
                ValdresScope({
                    get children() {
                        return null
                    },
                })
                dispose()
            })
        }).toThrow("No valdres store found")
    })

    test("inherits values from parent store", () => {
        const nameAtom = atom("default")
        const rootStore = createStore({ batchUpdates: true })
        createRoot(dispose => {
            ValdresProvider({
                store: rootStore,
                get children() {
                    ValdresScope({
                        scopeId: "test-scope",
                        get children() {
                            const value = createValue(nameAtom)
                            expect(value()).toBe("default")
                            return null
                        },
                    })
                    return null
                },
            })
            dispose()
        })
    })

    test("initialize with array return", () => {
        const countAtom = atom(0)
        const rootStore = createStore({ batchUpdates: true })
        createRoot(dispose => {
            ValdresProvider({
                store: rootStore,
                get children() {
                    ValdresScope({
                        scopeId: "init-scope",
                        initialize: () => [[countAtom, 42]],
                        get children() {
                            const value = createValue(countAtom)
                            expect(value()).toBe(42)
                            return null
                        },
                    })
                    return null
                },
            })
            dispose()
        })
    })

    test("initialize with txn.set", () => {
        const countAtom = atom(0)
        const rootStore = createStore({ batchUpdates: true })
        createRoot(dispose => {
            ValdresProvider({
                store: rootStore,
                get children() {
                    ValdresScope({
                        scopeId: "txn-scope",
                        initialize: txn => {
                            txn.set(countAtom, 99)
                        },
                        get children() {
                            const value = createValue(countAtom)
                            expect(value()).toBe(99)
                            return null
                        },
                    })
                    return null
                },
            })
            dispose()
        })
    })

    test("scoped store is accessible by id", () => {
        const rootStore = createStore({ id: "root", batchUpdates: true })
        createRoot(dispose => {
            ValdresProvider({
                store: rootStore,
                get children() {
                    ValdresScope({
                        scopeId: "my-scope",
                        get children() {
                            const root = useStore("root")
                            expect(root.data.id).toBe("root")
                            return null
                        },
                    })
                    return null
                },
            })
            dispose()
        })
    })

    test("scope detaches on cleanup", () => {
        const rootStore = createStore({ batchUpdates: true })
        createRoot(dispose => {
            ValdresProvider({
                store: rootStore,
                get children() {
                    createRoot(innerDispose => {
                        ValdresScope({
                            scopeId: "cleanup-scope",
                            get children() {
                                return null
                            },
                        })
                        expect(rootStore.data.scopes?.has("cleanup-scope")).toBe(true)
                        innerDispose()
                    })
                    expect(rootStore.data.scopes?.has("cleanup-scope")).toBe(false)
                    return null
                },
            })
            dispose()
        })
    })
})
