import { describe, test, expect } from "bun:test"
import { atom } from "valdres"
import { generateStoreAndRenderHook } from "./generateStoreAndRenderHook"
import { useValdresValueWithDefault } from "../src/useValdresValueWithDefault"
import { useValue } from "../src/useValue"

describe("getSnapshot stability with pending transaction", () => {
    test("useValdresValueWithDefault: set before render returns set value", () => {
        const objAtom = atom<{ count: number }>()
        const [store, renderHook] = generateStoreAndRenderHook()

        store.set(objAtom, { count: 1 })

        const { result } = renderHook(() =>
            useValdresValueWithDefault(objAtom, { count: 0 }),
        )
        expect(result.current).toStrictEqual({ count: 1 })
    })

    test("useValue: set object before rerender returns correct value", () => {
        const objAtom = atom<{ count: number }>({ count: 0 })
        const [store, renderHook] = generateStoreAndRenderHook()

        const { result, rerender } = renderHook(() => useValue(objAtom))
        expect(result.current).toStrictEqual({ count: 0 })

        store.set(objAtom, { count: 1 })
        rerender()
        expect(result.current).toStrictEqual({ count: 1 })
    })
})
