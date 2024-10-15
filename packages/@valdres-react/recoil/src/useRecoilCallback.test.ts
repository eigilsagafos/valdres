import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom } from "./atom"
import { useRecoilCallback } from "./useRecoilCallback"

describe("recoil/useRecoilCallback", () => {
    test("default", () => {
        const numberAtom = atom({ default: 10, key: "test" })
        const { result } = renderHook(() =>
            useRecoilCallback<[], [number, number]>(
                ({ set, snapshot }) =>
                    () => {
                        const get1 = snapshot.getLoadable(numberAtom).contents
                        set(numberAtom, curr => (curr += 10))
                        const get2 = snapshot.getLoadable(numberAtom).contents
                        return [get1, get2]
                    },
            ),
        )
        expect(result.current()).toStrictEqual([10, 10])
        expect(result.current()).toStrictEqual([20, 20])
    })
})
