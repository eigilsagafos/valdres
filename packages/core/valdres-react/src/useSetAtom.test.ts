import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom, getDefaultStore } from "valdres"
import { useSetAtom } from "./useSetAtom"

describe("useSetAtom", () => {
    test("default", () => {
        const numberAtom = atom(10)
        const store = getDefaultStore()
        const { result } = renderHook(() => useSetAtom(numberAtom))
        expect(store.get(numberAtom)).toBe(10)
        result.current(20)
        expect(store.get(numberAtom)).toBe(20)
    })
})
