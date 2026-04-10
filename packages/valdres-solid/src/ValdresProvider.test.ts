import { describe, test, expect, mock } from "bun:test"
import { createRoot } from "solid-js"
import { atom, store as createStore } from "valdres"
import { ValdresProvider } from "./ValdresProvider"
import { useStore } from "./useStore"
import { createValue } from "./createValue"

describe("ValdresProvider", () => {
    test("auto-creates store with batchUpdates", () => {
        createRoot(dispose => {
            ValdresProvider({
                get children() {
                    const store = useStore()
                    expect(store).toBeDefined()
                    expect(store.data.batchUpdates).toBe(true)
                    return null
                },
            })
            dispose()
        })
    })

    test("accepts existing store", () => {
        const storeInstance = createStore({ id: "test-store", batchUpdates: true })
        createRoot(dispose => {
            ValdresProvider({
                store: storeInstance,
                get children() {
                    const store = useStore()
                    expect(store.data.id).toBe("test-store")
                    return null
                },
            })
            dispose()
        })
    })

    test("initialize with array return", () => {
        const countAtom = atom(0)
        createRoot(dispose => {
            ValdresProvider({
                initialize: () => [[countAtom, 42]],
                get children() {
                    const value = createValue(countAtom)
                    expect(value()).toBe(42)
                    return null
                },
            })
            dispose()
        })
    })

    test("initialize with txn.set", () => {
        const countAtom = atom(0)
        createRoot(dispose => {
            ValdresProvider({
                initialize: txn => {
                    txn.set(countAtom, 99)
                },
                get children() {
                    const value = createValue(countAtom)
                    expect(value()).toBe(99)
                    return null
                },
            })
            dispose()
        })
    })

    test("warns when store lacks batchUpdates", () => {
        const warn = mock(() => {})
        const origWarn = console.warn
        console.warn = warn
        const storeInstance = createStore("no-batch")
        createRoot(dispose => {
            ValdresProvider({
                store: storeInstance,
                get children() {
                    return null
                },
            })
            dispose()
        })
        console.warn = origWarn
        expect(warn).toHaveBeenCalledTimes(1)
    })

    test("nested providers preserve ancestor stores", () => {
        const storeA = createStore({ id: "A", batchUpdates: true })
        const storeB = createStore({ id: "B", batchUpdates: true })
        createRoot(dispose => {
            ValdresProvider({
                store: storeA,
                get children() {
                    ValdresProvider({
                        store: storeB,
                        get children() {
                            const current = useStore()
                            expect(current.data.id).toBe("B")
                            const ancestor = useStore("A")
                            expect(ancestor.data.id).toBe("A")
                            return null
                        },
                    })
                    return null
                },
            })
            dispose()
        })
    })
})
