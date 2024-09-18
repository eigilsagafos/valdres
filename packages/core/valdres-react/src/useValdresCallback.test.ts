import { describe, test, expect } from "bun:test"
import { renderHook } from "@testing-library/react-hooks"
import { atom } from "valdres"
import { useValdresCallback } from "./useValdresCallback"

describe("useValdresCallback", () => {
    test("default", () => {
        const numberAtom = atom(10)
        const { result } = renderHook(() =>
            useValdresCallback(({ snapshot }) => args => {
                const res = snapshot.getLoadable(numberAtom).contents
                return [args, res]
            }),
        )
        // console.log(result.current(`foo`))
        expect(result.current("Foo")).toStrictEqual(["Foo", 10])
    })
})
