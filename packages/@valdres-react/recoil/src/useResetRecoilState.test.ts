import { describe, test, expect } from "bun:test"
import { waitFor, renderHook } from "@testing-library/react"
import { atom } from "./atom"
import { useRecoilState } from "./useRecoilState"
import { useResetRecoilState } from "./useResetRecoilState"

describe("recoil/useRecoilValue", () => {
    test("default", () => {
        const numberAtom = atom({ key: "number", default: 10 })
        const { result } = renderHook(() => {
            const [value, set] = useRecoilState(numberAtom)
            const reset = useResetRecoilState(numberAtom)
            return { value, set, reset }
        })
        expect(result.current.value).toBe(10)
        result.current.set(20)
        expect(result.current.value).toBe(20)
        result.current.reset()
        waitFor(() => {
            expect(result.current.value).toBe(10)
        })
    })
})
