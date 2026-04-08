import { describe, test, expect } from "bun:test"
import { atom, selector } from "valdres"
import { generateStoreAndRenderHook } from "./generateStoreAndRenderHook"
import { useValue } from "../src/useValue"

describe("batchUpdates with falsy values", () => {
    test("store.get reads 0 from pending transaction", () => {
        const numberAtom = atom(5)
        const [store, renderHook] = generateStoreAndRenderHook()
        renderHook(() => useValue(numberAtom))

        store.set(numberAtom, 0)
        expect(store.get(numberAtom)).toBe(0)
    })

    test("store.get reads false from pending transaction", () => {
        const boolAtom = atom(true)
        const [store, renderHook] = generateStoreAndRenderHook()
        renderHook(() => useValue(boolAtom))

        store.set(boolAtom, false)
        expect(store.get(boolAtom)).toBe(false)
    })

    test("store.get reads empty string from pending transaction", () => {
        const strAtom = atom("hello")
        const [store, renderHook] = generateStoreAndRenderHook()
        renderHook(() => useValue(strAtom))

        store.set(strAtom, "")
        expect(store.get(strAtom)).toBe("")
    })

    test("selector reads falsy atom value from pending transaction", () => {
        const numberAtom = atom(5)
        const derived = selector(get => `value:${get(numberAtom)}`)
        const [store, renderHook] = generateStoreAndRenderHook()
        renderHook(() => useValue(derived))

        store.set(numberAtom, 0)
        expect(store.get(derived)).toBe("value:0")
    })

    test("callback-style set reads correct current value from pending txn", () => {
        const numberAtom = atom(5)
        const [store, renderHook] = generateStoreAndRenderHook()
        renderHook(() => useValue(numberAtom))

        store.set(numberAtom, 0)
        store.set(numberAtom, curr => curr + 1)
        expect(store.get(numberAtom)).toBe(1)
    })
})
