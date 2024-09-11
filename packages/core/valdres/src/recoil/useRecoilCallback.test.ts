import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom } from "./atom"
import { useRecoilCallback } from "./useRecoilCallback"

describe("recoil/useRecoilCallback", () => {
    test.todo("default", () => {
        const numberAtom = atom(10)
        const { result } = renderHook(() =>
            useRecoilCallback(({ snapshot }) => args => {
                console.log(args)
                const res = snapshot.getLoadable(numberAtom).contents
                console.log(res)
            }),
        )
        console.log(result.current(`foo`))
        result.current(`stuff`)
    })
})
