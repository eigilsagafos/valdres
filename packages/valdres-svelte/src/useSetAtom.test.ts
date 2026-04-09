import { describe, test, expect } from "bun:test"
import { atom, store } from "valdres"
import { useSetAtom } from "./useSetAtom"

describe("useSetAtom", () => {
    test("returns a setter function", () => {
        const countAtom = atom(0)
        const s = store()
        const setter = useSetAtom(countAtom, s)

        expect(typeof setter).toBe("function")
    })

    test("setter updates the atom value in the store", () => {
        const countAtom = atom(0)
        const s = store()
        const setter = useSetAtom(countAtom, s)

        setter(5)
        expect(s.get(countAtom)).toBe(5)
    })

    test("setter accepts callback updater", () => {
        const countAtom = atom(10)
        const s = store()
        const setter = useSetAtom(countAtom, s)

        setter((prev: number) => prev + 5)
        expect(s.get(countAtom)).toBe(15)
    })
})
