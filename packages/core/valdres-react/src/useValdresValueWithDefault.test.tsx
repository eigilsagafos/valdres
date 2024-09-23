import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom, atomFamily, getDefaultStore } from "valdres"
import { useValdresValueWithDefault } from "./useValdresValueWithDefault"

describe("useValdresValueWithDefault", () => {
    test("atom", () => {
        const numberAtom = atom()
        const { result } = renderHook(() =>
            useValdresValueWithDefault(numberAtom, 10),
        )
        expect(result.current).toBe(10)
        const store = getDefaultStore()
        store.set(numberAtom, 20)
        expect(result.current).toBe(20)
    })

    test("atomFamily", async () => {
        const family = atomFamily()
        const atom = family("1")
        const { result } = renderHook(() => useValdresValueWithDefault(atom, 1))
        expect(result.current).toBe(1)
        const store = getDefaultStore()
        store.set(atom, 2)
        expect(result.current).toBe(2)
        store.txn(set => {
            set(atom, 3)
            set(atom, 4)
        })
        expect(result.current).toBe(4)
    })
})
