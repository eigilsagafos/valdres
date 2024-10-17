import { describe, test, expect } from "bun:test"
import { atom } from "valdres"
import { useSetAtom } from "./useSetAtom"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"

describe("useSetAtom", () => {
    test("default", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom(10)
        const { result } = renderHook(() => useSetAtom(numberAtom))
        expect(store.get(numberAtom)).toBe(10)
        result.current(20)
        expect(store.get(numberAtom)).toBe(20)
    })
})
