import { describe, test, expect } from "bun:test"
import { atom, atomFamily } from "valdres"
import { useValdresValueWithDefault } from "./useValdresValueWithDefault"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"

describe("useValdresValueWithDefault", () => {
    test("atom", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom()
        const { result } = renderHook(() =>
            useValdresValueWithDefault(numberAtom, 10),
        )
        expect(result.current).toBe(10)
        store.set(numberAtom, 20)
        expect(result.current).toBe(20)
    })

    test("atomWithCallback", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const numberAtom = atom()
        const { result } = renderHook(() =>
            useValdresValueWithDefault(numberAtom, () => 10),
        )
        expect(result.current).toBe(10)
        store.set(numberAtom, 20)
        expect(result.current).toBe(20)
    })

    test("callback using get", () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const stringAtom = atom("1")
        const numberAtom = atom()
        const { result } = renderHook(() =>
            useValdresValueWithDefault(numberAtom, get =>
                Number(get(stringAtom)),
            ),
        )
        expect(result.current).toBe(1)
    })

    test("atomFamily", async () => {
        const [store, renderHook] = generateStoreAndRenderHook()
        const family = atomFamily<number, string>()
        const atom = family("1")
        const { result } = renderHook(() =>
            useValdresValueWithDefault(family("1"), 1),
        )
        expect(result.current).toBe(1)
        store.set(atom, 2)
        expect(result.current).toBe(2)
        store.txn(set => {
            set(atom, 3)
            set(atom, 4)
        })
        expect(result.current).toBe(4)
    })
})
