import { describe, test, expect } from "bun:test"
import { createRoot } from "solid-js"
import {
    atom,
    atomFamily,
    selector,
    selectorFamily,
    store as createStore,
} from "valdres"
import { createValue } from "./createValue"

describe("createValue", () => {
    test("atom", () => {
        const numberAtom = atom(10)
        const storeInstance = createStore()
        createRoot(dispose => {
            const value = createValue(numberAtom, storeInstance)
            expect(value()).toBe(10)
            dispose()
        })
    })

    test("reacts to store changes", () => {
        const numberAtom = atom(10)
        const storeInstance = createStore()
        createRoot(dispose => {
            const value = createValue(numberAtom, storeInstance)
            expect(value()).toBe(10)
            storeInstance.set(numberAtom, 20)
            expect(value()).toBe(20)
            dispose()
        })
    })

    test("selector", () => {
        const numberAtom = atom(10)
        const doubleSelector = selector(get => get(numberAtom) * 2)
        const storeInstance = createStore()
        createRoot(dispose => {
            const value = createValue(doubleSelector, storeInstance)
            expect(value()).toBe(20)
            storeInstance.set(numberAtom, 20)
            expect(value()).toBe(40)
            dispose()
        })
    })

    test("selectorFamily", () => {
        const numberAtom = atom(10)
        const multiply = selectorFamily(
            (factor: number) => (get: any) => get(numberAtom) * factor,
        )
        const storeInstance = createStore()
        createRoot(dispose => {
            const value = createValue(multiply(3), storeInstance)
            expect(value()).toBe(30)
            storeInstance.set(numberAtom, 20)
            expect(value()).toBe(60)
            dispose()
        })
    })

    test("atomFamily", () => {
        const family = atomFamily(1)
        const familyAtom = family("key1")
        const storeInstance = createStore()
        createRoot(dispose => {
            const value = createValue(familyAtom, storeInstance)
            expect(value()).toBe(1)
            storeInstance.set(familyAtom, 99)
            expect(value()).toBe(99)
            dispose()
        })
    })

    test("unsubscribes on dispose", () => {
        const numberAtom = atom(10)
        const storeInstance = createStore()
        let accessor: () => number
        createRoot(dispose => {
            accessor = createValue(numberAtom, storeInstance)
            expect(accessor()).toBe(10)
            storeInstance.set(numberAtom, 20)
            expect(accessor()).toBe(20)
            dispose()
        })
        storeInstance.set(numberAtom, 999)
        // After dispose, the signal still holds the last value before dispose
        expect(accessor!()).toBe(20)
    })
})
