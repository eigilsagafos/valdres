import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react"
import { atom } from "./atom"
import { useRecoilValue } from "./useRecoilValue"
import { useSetRecoilState } from "./useSetRecoilState"

describe("recoil/useRecoilValue", () => {
    test("default", () => {
        const numberAtom = atom({ key: "number", default: 10 })
        const { result } = renderHook(() => {
            const set = useSetRecoilState(numberAtom)
            const value = useRecoilValue(numberAtom)
            return { set, value }
        })
        expect(result.current.value).toBe(10)
        result.current.set(20)
        expect(result.current.value).toBe(20)
    })
})
