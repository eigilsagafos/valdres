import { describe, expect, test } from "bun:test"
import { median } from "./median"

describe("median", () => {
    test("rejects one anomalously fast sample", () => {
        expect(median([279, 289, 193])).toBe(279)
    })

    test("rejects one anomalously slow sample", () => {
        expect(median([279, 289, 900])).toBe(289)
    })

    test("supports single and even sample counts", () => {
        expect(median([42])).toBe(42)
        expect(median([10, 20])).toBe(15)
    })

    test("rejects an empty sample set", () => {
        expect(() => median([])).toThrow("Cannot take median of no values")
    })
})
