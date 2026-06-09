import { describe, expect, test } from "bun:test"
import { createLRU } from "./createLRU"

describe("createLRU", () => {
    test("evicts the least-recently-used entry past capacity", () => {
        const lru = createLRU<string, number>(2)
        lru.set("a", 1)
        lru.set("b", 2)
        lru.set("c", 3) // evicts "a"
        expect(lru.has("a")).toBe(false)
        expect(lru.has("b")).toBe(true)
        expect(lru.has("c")).toBe(true)
        expect(lru.size).toBe(2)
    })

    test("get marks an entry as recently used", () => {
        const lru = createLRU<string, number>(2)
        lru.set("a", 1)
        lru.set("b", 2)
        expect(lru.get("a")).toBe(1) // "a" now most-recent
        lru.set("c", 3) // evicts "b", not "a"
        expect(lru.has("a")).toBe(true)
        expect(lru.has("b")).toBe(false)
    })

    test("set on an existing key refreshes recency, not size", () => {
        const lru = createLRU<string, number>(2)
        lru.set("a", 1)
        lru.set("b", 2)
        lru.set("a", 11) // "a" most-recent
        lru.set("c", 3) // evicts "b"
        expect(lru.size).toBe(2)
        expect(lru.get("a")).toBe(11)
        expect(lru.has("b")).toBe(false)
    })

    test("unbounded when capacity is 0 or Infinity", () => {
        for (const cap of [0, Infinity]) {
            const lru = createLRU<number, number>(cap)
            for (let i = 0; i < 1000; i++) lru.set(i, i)
            expect(lru.size).toBe(1000)
            expect(lru.get(0)).toBe(0)
        }
    })

    test("delete and clear", () => {
        const lru = createLRU<string, number>(10)
        lru.set("a", 1)
        lru.set("b", 2)
        expect(lru.delete("a")).toBe(true)
        expect(lru.delete("a")).toBe(false)
        expect(lru.size).toBe(1)
        lru.clear()
        expect(lru.size).toBe(0)
    })

    test("stores falsy values without confusing them for absence", () => {
        const lru = createLRU<string, number>(3)
        lru.set("zero", 0)
        expect(lru.has("zero")).toBe(true)
        expect(lru.get("zero")).toBe(0)
    })
})
