import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom } from "./atom"
import { useRecoilState } from "./useRecoilState"

describe("recoil/useRecoilState", () => {
    test("default", () => {
        const numberAtom = atom({ default: 10, key: "number" })
        const { result } = renderHook(() => useRecoilState(numberAtom))
        expect(result.current[0]).toBe(10)
        result.current[1](20)
        expect(result.current[0]).toBe(20)
    })
})
