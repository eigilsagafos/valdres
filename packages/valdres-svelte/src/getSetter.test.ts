import { describe, test, expect } from "bun:test"
import { atom, store } from "valdres"
import { getSetter } from "./getSetter"

describe("getSetter", () => {
    test("returns a setter function", () => {
        const countAtom = atom(0)
        const s = store()
        const set = getSetter(countAtom, s)

        expect(typeof set).toBe("function")
    })

    test("setter updates the atom value in the store", () => {
        const countAtom = atom(0)
        const s = store()
        const set = getSetter(countAtom, s)

        set(5)
        expect(s.get(countAtom)).toBe(5)
    })

    test("setter accepts callback updater", () => {
        const countAtom = atom(10)
        const s = store()
        const set = getSetter(countAtom, s)

        set((prev: number) => prev + 5)
        expect(s.get(countAtom)).toBe(15)
    })
})
