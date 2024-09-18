import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { useValdresState } from "./useValdresState"
import { atom } from "valdres"

describe("useValdresState", () => {
    test("default", () => {
        const numberAtom = atom(10)
        const { result } = renderHook(() => useValdresState(numberAtom))
        expect(result.current[0]).toBe(10)
        result.current[1](20)
        expect(result.current[0]).toBe(20)
    })
})
