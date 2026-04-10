import { describe, test, expect } from "bun:test"
import { createRoot } from "solid-js"
import { atom, store as createStore } from "valdres"
import { createAtom } from "./createAtom"

describe("createAtom", () => {
    test("returns accessor and setter", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        createRoot(dispose => {
            const [count, setCount] = createAtom(countAtom, storeInstance)
            expect(count()).toBe(0)
            setCount(5)
            expect(count()).toBe(5)
            expect(storeInstance.get(countAtom)).toBe(5)
            dispose()
        })
    })

    test("reacts to external store changes", () => {
        const countAtom = atom(10)
        const storeInstance = createStore()
        createRoot(dispose => {
            const [count] = createAtom(countAtom, storeInstance)
            expect(count()).toBe(10)
            storeInstance.set(countAtom, 42)
            expect(count()).toBe(42)
            dispose()
        })
    })

    test("setter supports updater function", () => {
        const countAtom = atom(10)
        const storeInstance = createStore()
        createRoot(dispose => {
            const [count, setCount] = createAtom(countAtom, storeInstance)
            setCount((prev: number) => prev + 5)
            expect(count()).toBe(15)
            dispose()
        })
    })

    test("unsubscribes on dispose", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        let accessor: () => number
        createRoot(dispose => {
            const [count, setCount] = createAtom(countAtom, storeInstance)
            setCount(1)
            expect(count()).toBe(1)
            accessor = count
            dispose()
        })
        storeInstance.set(countAtom, 999)
        expect(accessor!()).toBe(1)
    })
})
