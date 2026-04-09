import { describe, test, expect } from "bun:test"
import { atom, store } from "valdres"
import { useResetAtom } from "./useResetAtom"

describe("useResetAtom", () => {
    test("returns a reset function", () => {
        const countAtom = atom(0)
        const s = store()
        const reset = useResetAtom(countAtom, s)

        expect(typeof reset).toBe("function")
    })

    test("reset restores the atom to its default value", () => {
        const countAtom = atom(42)
        const s = store()

        s.set(countAtom, 100)
        expect(s.get(countAtom)).toBe(100)

        const reset = useResetAtom(countAtom, s)
        reset()

        expect(s.get(countAtom)).toBe(42)
    })
})
