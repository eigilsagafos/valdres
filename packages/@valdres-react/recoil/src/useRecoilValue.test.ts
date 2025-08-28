import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react"
import { atom } from "./atom"
import { useRecoilValue } from "./useRecoilValue"

describe("recoil/useRecoilValue", () => {
    test("default", () => {
        const numberAtom = atom({ key: "number", default: 10 })
        const { result } = renderHook(() => useRecoilValue(numberAtom))
        expect(result.current).toBe(10)
    })
})
