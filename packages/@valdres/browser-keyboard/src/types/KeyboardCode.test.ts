import { describe, expect, test } from "bun:test"
import { keyboardCodes } from "./KeyboardCode"

describe("keyboardCodes", () => {
    test("lists each UI Events code once, plus F13–F24", () => {
        expect(new Set(keyboardCodes).size).toBe(keyboardCodes.length)
        // 172 codes defined by https://www.w3.org/TR/uievents-code/ + F13–F24.
        expect(keyboardCodes).toHaveLength(184)
    })

    test("includes the codes the pre-v1 list was missing", () => {
        for (const code of [
            "PageUp",
            "Insert",
            "NumLock",
            "ScrollLock",
            "Pause",
            "PrintScreen",
            "ContextMenu",
            "Numpad0",
            "NumpadEnter",
            "F13",
            "F24",
            "IntlBackslash",
            "Fn",
            "MediaPlayPause",
            "Unidentified",
        ])
            expect(keyboardCodes).toContain(
                code as (typeof keyboardCodes)[number],
            )
    })
})
