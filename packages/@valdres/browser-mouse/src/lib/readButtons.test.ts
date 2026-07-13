import { describe, expect, test } from "bun:test"
import { readButtons } from "./readButtons"

describe("readButtons", () => {
    test("no buttons pressed", () => {
        expect(readButtons(0)).toEqual({
            buttons: 0,
            left: false,
            right: false,
            middle: false,
        })
    })

    test("left button (bit 1)", () => {
        const b = readButtons(1)
        expect(b.left).toBe(true)
        expect(b.right).toBe(false)
        expect(b.middle).toBe(false)
    })

    test("right button (bit 2)", () => {
        const b = readButtons(2)
        expect(b.left).toBe(false)
        expect(b.right).toBe(true)
    })

    test("middle button (bit 4)", () => {
        expect(readButtons(4).middle).toBe(true)
    })

    test("left + right pressed together", () => {
        const b = readButtons(1 | 2)
        expect(b.left).toBe(true)
        expect(b.right).toBe(true)
        expect(b.middle).toBe(false)
    })
})
