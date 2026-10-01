import { describe, expect, test } from "bun:test"
import { toKeyDown, type KeyDownObservation } from "./toKeyDown"

const seen: KeyDownObservation = { editable: false, defaultPrevented: false }

const event = (
    type: "keydown" | "keyup",
    overrides: Partial<KeyboardEvent> = {},
): KeyboardEvent =>
    ({
        type,
        code: "KeyA",
        key: "a",
        repeat: false,
        keyCode: 65,
        isComposing: false,
        timeStamp: 12,
        ...overrides,
    }) as unknown as KeyboardEvent

describe("toKeyDown", () => {
    test("builds a frozen KeyDown from a keydown", () => {
        const keyDown = toKeyDown(event("keydown", { repeat: true }), 7, seen)
        expect(keyDown).toEqual({
            code: "KeyA",
            key: "a",
            repeat: true,
            timeStamp: 12,
            sequence: 7,
            editable: false,
            defaultPrevented: false,
        })
        expect(Object.isFrozen(keyDown)).toBe(true)
    })

    test("carries what the listener observed, not what the event says now", () => {
        const keyDown = toKeyDown(
            event("keydown", { defaultPrevented: false }),
            3,
            {
                editable: true,
                defaultPrevented: true,
            },
        )
        expect(keyDown?.editable).toBe(true)
        expect(keyDown?.defaultPrevented).toBe(true)
    })

    test("ignores keyups", () => {
        expect(toKeyDown(event("keyup"), 1, seen)).toBe(null)
    })

    test("ignores IME composition keydowns", () => {
        expect(
            toKeyDown(event("keydown", { isComposing: true }), 1, seen),
        ).toBe(null)
        expect(toKeyDown(event("keydown", { keyCode: 229 }), 1, seen)).toBe(
            null,
        )
    })

    test("reports modifier and lock keydowns like any other key", () => {
        expect(
            toKeyDown(
                event("keydown", { code: "CapsLock", key: "CapsLock" }),
                1,
                seen,
            )?.code,
        ).toBe("CapsLock")
        expect(
            toKeyDown(
                event("keydown", { code: "ShiftLeft", key: "Shift" }),
                1,
                seen,
            )?.code,
        ).toBe("ShiftLeft")
    })
})
