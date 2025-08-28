import { describe, expect, test } from "bun:test"
import { atom } from "valdres"
import { generateStoreAndRenderHook } from "../test/generateStoreAndRenderHook"
import { useTransaction } from "./useTransaction"
import { useValue } from "./useValue"

describe("useTransaction", () => {
    test("default", () => {
        const valueAtom = atom("Foo")
        const useTestHook = () => {
            return {
                value: useValue(valueAtom),
                txn: useTransaction(),
            }
        }
        const [, renderHook] = generateStoreAndRenderHook()
        const { result, rerender } = renderHook(() => useTestHook())
        expect(result.current.value).toBe("Foo")
        result.current.txn(state => state.set(valueAtom, "Bar"))
        rerender()
        expect(result.current.value).toBe("Bar")
    })
})
