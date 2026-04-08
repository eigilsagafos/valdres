import { describe, test, expect } from "bun:test"
import { atom, store } from "valdres"

describe("store() API backward compatibility", () => {
    test("store() with no args", () => {
        const s = store()
        expect(s.data.id).toMatch(/^__valdres_store_/)
        expect(s.data.batchUpdates).toBeUndefined()
    })

    test("store(string) still works", () => {
        const s = store("my-store")
        expect(s.data.id).toBe("my-store")
        expect(s.data.batchUpdates).toBeUndefined()
    })

    test("store({ id, batchUpdates })", () => {
        const s = store({ id: "batched-store", batchUpdates: true })
        expect(s.data.id).toBe("batched-store")
        expect(s.data.batchUpdates).toBe(true)
    })

    test("store({ batchUpdates }) without id gets auto-id", () => {
        const s = store({ batchUpdates: true })
        expect(s.data.id).toMatch(/^__valdres_store_/)
        expect(s.data.batchUpdates).toBe(true)
    })

    test("store() without batchUpdates behaves synchronously", () => {
        const s = store()
        const a = atom(0)
        const callback = { called: 0 }
        s.sub(a, () => { callback.called++ })
        s.set(a, 1)
        // Synchronous: subscriber called immediately
        expect(callback.called).toBe(1)
    })

    test("store({ batchUpdates: true }) defers subscriber notification", () => {
        const s = store({ batchUpdates: true })
        const a = atom(0)
        s.get(a) // initialize
        const callback = { called: 0 }
        s.sub(a, () => { callback.called++ })
        s.set(a, 1)
        // Deferred: subscriber NOT called yet
        expect(callback.called).toBe(0)
    })
})
