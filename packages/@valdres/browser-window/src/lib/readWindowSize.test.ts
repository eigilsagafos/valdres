import { describe, expect, test } from "bun:test"
import { readWindowSize } from "./readWindowSize"

describe("readWindowSize", () => {
    test("returns inner/outer dimensions from window", () => {
        const size = readWindowSize()
        expect(size.innerWidth).toBe(window.innerWidth)
        expect(size.innerHeight).toBe(window.innerHeight)
        expect(size.outerWidth).toBe(window.outerWidth)
        expect(size.outerHeight).toBe(window.outerHeight)
    })
})
