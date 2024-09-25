import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom } from "valdres"
import { useValdresCallback } from "./useValdresCallback"
import { useValdresValue } from "./useValdresValue"

describe("useValdresCallback", () => {
    test("ValdresProvider", () => {
        const previousValueAtom = atom("")
        const currentValueAtom = atom("Foo")
        const useTestHook = () => {
            return {
                previousValue: useValdresValue(previousValueAtom),
                currentValue: useValdresValue(currentValueAtom),
                callback: useValdresCallback(
                    (set, get) => (newValue: string) => {
                        set(previousValueAtom, get(currentValueAtom))
                        set(currentValueAtom, newValue)
                    },
                    [],
                ),
            }
        }
        const { result } = renderHook(() => useTestHook())
        expect(result.current.previousValue).toBe("")
        expect(result.current.currentValue).toBe("Foo")
        result.current.callback("Bar")
        expect(result.current.previousValue).toBe("Foo")
        expect(result.current.currentValue).toBe("Bar")
    })
})
