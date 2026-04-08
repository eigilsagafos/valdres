import { describe, test, expect } from "bun:test"
import { atom, store } from "valdres"

describe("batchUpdates set return value", () => {
    test("store.set returns the new value in batched mode", () => {
        const s = store({ batchUpdates: true })
        const numberAtom = atom(0)
        s.get(numberAtom) // initialize

        const result = s.set(numberAtom, 42)
        expect(result).toBe(42)
    })

    test("store.set with callback returns the new value", () => {
        const s = store({ batchUpdates: true })
        const numberAtom = atom(10)
        s.get(numberAtom) // initialize

        const result = s.set(numberAtom, curr => curr * 2)
        expect(result).toBe(20)
    })
})
