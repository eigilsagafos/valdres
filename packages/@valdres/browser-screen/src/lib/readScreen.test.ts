import { describe, expect, test } from "bun:test"
import { readScreen } from "./readScreen"

describe("readScreen", () => {
    test("returns a plain snapshot of window.screen + devicePixelRatio", () => {
        const info = readScreen()
        expect(info.width).toBe(window.screen.width)
        expect(info.height).toBe(window.screen.height)
        expect(info.availWidth).toBe(window.screen.availWidth)
        expect(info.availHeight).toBe(window.screen.availHeight)
        expect(info.devicePixelRatio).toBe(window.devicePixelRatio)
        expect(typeof info.orientationType).toBe("string")
        expect(typeof info.orientationAngle).toBe("number")
    })
})
