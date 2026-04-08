import { describe, test, expect } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"

describe("batched flush error handling", () => {
    test("values are committed to the store after batched flush", async () => {
        const s = store({ batchUpdates: true })
        const a = atom(0)
        const b = atom(0)
        s.get(a) // initialize
        s.get(b) // initialize

        s.set(a, 1)
        s.set(b, 2)

        // Before microtask flush: values readable through pending txn
        expect(s.get(a)).toBe(1)
        expect(s.get(b)).toBe(2)

        // Wait for microtask flush to commit
        await new Promise(r => queueMicrotask(r))

        // After flush: values are committed to store data
        expect(s.data.values.get(a)).toBe(1)
        expect(s.data.values.get(b)).toBe(2)
    })

    test("new sets after flush create a fresh implicit transaction", async () => {
        const s = store({ batchUpdates: true })
        const a = atom(0)
        s.get(a) // initialize

        s.set(a, 1)

        // Wait for first flush
        await new Promise(r => queueMicrotask(r))

        expect(s.get(a)).toBe(1)

        // Second set should create a new implicit transaction
        s.set(a, 2)
        expect(s.get(a)).toBe(2)

        await new Promise(r => queueMicrotask(r))
        expect(s.data.values.get(a)).toBe(2)
    })

    test("subscriber error in non-batched mode throws synchronously", () => {
        const s = store() // no batchUpdates
        const a = atom(0)
        s.get(a)

        s.sub(a, () => {
            throw new Error("sync subscriber error")
        })

        // Non-batched: error surfaces synchronously from set()
        expect(() => s.set(a, 1)).toThrow("sync subscriber error")
    })
})
