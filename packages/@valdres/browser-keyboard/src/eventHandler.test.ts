import { describe, test, expect, beforeEach } from "bun:test"
import { store } from "valdres"
import { eventHandler } from "./lib/eventHandler"
import { clearAllPressed } from "./lib/clearAllPressed"
import { pressedKeysAtom } from "./atoms/pressedKeysAtom"
import { pressedCodesSelector } from "./selectors/pressedCodesSelector"
import { pressedKeyValuesSelector } from "./selectors/pressedKeyValuesSelector"
import { modifierSelector } from "./selectors/modifierSelector"
import { toggleKeyAtom } from "./atoms/toggleKeyAtom"

const mockLockState: Record<string, boolean> = {
    CapsLock: false,
    NumLock: false,
    ScrollLock: false,
}

const makeKeyEvent = (
    type: "keydown" | "keyup",
    code: string,
    key: string,
    overrides: Partial<KeyboardEvent> = {},
): KeyboardEvent =>
    ({
        type,
        code,
        key,
        target: null,
        keyCode: 0,
        isComposing: false,
        timeStamp: performance.now(),
        getModifierState: (mod: string) => mockLockState[mod] ?? false,
        ...overrides,
    }) as unknown as KeyboardEvent

beforeEach(() => {
    clearAllPressed()
    mockLockState.CapsLock = false
    mockLockState.NumLock = false
    mockLockState.ScrollLock = false
})

describe("eventHandler", () => {
    test("tracks a single keydown", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        expect(s.get(pressedCodesSelector)).toEqual(["KeyA"])
        expect(s.get(pressedKeyValuesSelector)).toEqual(["a"])
    })

    test("tracks keyup and removes key", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        eventHandler(makeKeyEvent("keyup", "KeyA", "a"))
        expect(s.get(pressedCodesSelector)).toEqual([])
        expect(s.get(pressedKeyValuesSelector)).toEqual([])
    })

    test("tracks multiple simultaneous keys", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        eventHandler(makeKeyEvent("keydown", "KeyB", "b"))
        expect(s.get(pressedCodesSelector)).toEqual(["KeyA", "KeyB"])
        expect(s.get(pressedKeyValuesSelector)).toEqual(["a", "b"])

        eventHandler(makeKeyEvent("keyup", "KeyA", "a"))
        expect(s.get(pressedCodesSelector)).toEqual(["KeyB"])
        expect(s.get(pressedKeyValuesSelector)).toEqual(["b"])
    })

    test("does not duplicate on repeated keydown", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        expect(s.get(pressedCodesSelector)).toEqual(["KeyA"])
    })

    test("stores key, code, timeStamp, and target", () => {
        const s = store()
        const event = makeKeyEvent("keydown", "KeyA", "a")
        eventHandler(event)
        const pressed = s.get(pressedKeysAtom)
        expect(pressed).toHaveLength(1)
        expect(pressed[0].code).toBe("KeyA")
        expect(pressed[0].key).toBe("a")
        expect(pressed[0].timeStamp).toBe(event.timeStamp)
        expect(pressed[0].target).toBe(null)
    })

    test("keyup removes by code regardless of key case", () => {
        const s = store()
        // Press with CapsLock on (uppercase key)
        eventHandler(makeKeyEvent("keydown", "KeyA", "A"))
        expect(s.get(pressedKeysAtom)).toHaveLength(1)

        // CapsLock toggled off, release fires lowercase — still removes by code
        eventHandler(makeKeyEvent("keyup", "KeyA", "a"))
        expect(s.get(pressedKeysAtom)).toEqual([])
    })

    test("modifier keys track correctly", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "ShiftLeft", "Shift"))
        eventHandler(makeKeyEvent("keydown", "KeyA", "A"))
        expect(s.get(pressedCodesSelector)).toEqual(["ShiftLeft", "KeyA"])
    })
})

describe("IME composition filtering", () => {
    test("ignores events with isComposing=true", () => {
        const s = store()
        eventHandler(
            makeKeyEvent("keydown", "KeyA", "a", { isComposing: true }),
        )
        expect(s.get(pressedKeysAtom)).toEqual([])
    })

    test("ignores events with keyCode 229", () => {
        const s = store()
        eventHandler(
            makeKeyEvent("keydown", "KeyA", "Process", { keyCode: 229 }),
        )
        expect(s.get(pressedKeysAtom)).toEqual([])
    })
})

describe("clearAllPressed (blur handling)", () => {
    test("clears all pressed state", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        eventHandler(makeKeyEvent("keydown", "ShiftLeft", "Shift"))
        expect(s.get(pressedKeysAtom)).toHaveLength(2)

        clearAllPressed()
        expect(s.get(pressedKeysAtom)).toEqual([])
    })
})

describe("macOS Meta key workaround", () => {
    const originalPlatform = globalThis.navigator?.platform

    const withMacPlatform = (fn: () => void) => {
        Object.defineProperty(globalThis.navigator, "platform", {
            value: "MacIntel",
            configurable: true,
        })
        try {
            fn()
        } finally {
            Object.defineProperty(globalThis.navigator, "platform", {
                value: originalPlatform,
                configurable: true,
            })
        }
    }

    test("cleans up stale keys when Meta is held on keydown", () => {
        withMacPlatform(() => {
            const s = store()
            clearAllPressed()

            eventHandler(makeKeyEvent("keydown", "MetaLeft", "Meta"))
            eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
            expect(s.get(pressedCodesSelector)).toEqual(["MetaLeft", "KeyA"])

            // Cmd+B — keyup for A never fired on macOS
            eventHandler(makeKeyEvent("keydown", "KeyB", "b"))
            expect(s.get(pressedCodesSelector)).toEqual(["MetaLeft", "KeyB"])
        })
    })

    test("handles MetaRight the same as MetaLeft", () => {
        withMacPlatform(() => {
            const s = store()
            clearAllPressed()

            eventHandler(makeKeyEvent("keydown", "MetaRight", "Meta"))
            eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
            eventHandler(makeKeyEvent("keydown", "KeyB", "b"))
            expect(s.get(pressedCodesSelector)).toEqual(["MetaRight", "KeyB"])
        })
    })

    test("Meta keyup clears Meta and keys after it", () => {
        withMacPlatform(() => {
            const s = store()
            clearAllPressed()

            eventHandler(makeKeyEvent("keydown", "MetaLeft", "Meta"))
            eventHandler(makeKeyEvent("keydown", "Minus", "-"))
            expect(s.get(pressedCodesSelector)).toEqual(["MetaLeft", "Minus"])

            eventHandler(makeKeyEvent("keyup", "MetaLeft", "Meta"))
            expect(s.get(pressedKeysAtom)).toEqual([])
        })
    })

    test("Meta keyup clears all keys including those pressed before Meta", () => {
        withMacPlatform(() => {
            const s = store()
            clearAllPressed()

            eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
            eventHandler(makeKeyEvent("keydown", "MetaLeft", "Meta"))
            eventHandler(makeKeyEvent("keydown", "Minus", "-"))

            eventHandler(makeKeyEvent("keyup", "MetaLeft", "Meta"))
            expect(s.get(pressedKeysAtom)).toEqual([])
        })
    })

    test("does not truncate on non-Apple platforms", () => {
        Object.defineProperty(globalThis.navigator, "platform", {
            value: "Win32",
            configurable: true,
        })
        try {
            const s = store()
            clearAllPressed()

            eventHandler(makeKeyEvent("keydown", "MetaLeft", "Meta"))
            eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
            eventHandler(makeKeyEvent("keydown", "KeyB", "b"))
            expect(s.get(pressedCodesSelector)).toEqual([
                "MetaLeft",
                "KeyA",
                "KeyB",
            ])
        } finally {
            Object.defineProperty(globalThis.navigator, "platform", {
                value: originalPlatform,
                configurable: true,
            })
        }
    })
})

describe("modifierSelector", () => {
    test("returns false when no modifiers pressed", () => {
        const s = store()
        expect(s.get(modifierSelector("shift"))).toBe(false)
        expect(s.get(modifierSelector("ctrl"))).toBe(false)
        expect(s.get(modifierSelector("alt"))).toBe(false)
        expect(s.get(modifierSelector("meta"))).toBe(false)
    })

    test("detects left modifier", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "ShiftLeft", "Shift"))
        expect(s.get(modifierSelector("shift"))).toBe(true)
        expect(s.get(modifierSelector("ctrl"))).toBe(false)
    })

    test("detects right modifier", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "ShiftRight", "Shift"))
        expect(s.get(modifierSelector("shift"))).toBe(true)
    })

    test("returns false after modifier released", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "ControlLeft", "Control"))
        expect(s.get(modifierSelector("ctrl"))).toBe(true)

        eventHandler(makeKeyEvent("keyup", "ControlLeft", "Control"))
        expect(s.get(modifierSelector("ctrl"))).toBe(false)
    })
})

describe("toggleKeyAtom", () => {
    test("all locks start as null (unknown until first event)", () => {
        const s = store()
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(null)
        expect(s.get(toggleKeyAtom("NumLock"))).toBe(null)
        expect(s.get(toggleKeyAtom("ScrollLock"))).toBe(null)
    })

    test("seeds all locks from first keyboard event", () => {
        const s = store()
        mockLockState.CapsLock = true
        mockLockState.NumLock = true
        mockLockState.ScrollLock = false
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(true)
        expect(s.get(toggleKeyAtom("NumLock"))).toBe(true)
        expect(s.get(toggleKeyAtom("ScrollLock"))).toBe(false)
    })

    test("updates only the specific lock when its key is pressed", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))

        mockLockState.CapsLock = true
        eventHandler(makeKeyEvent("keydown", "CapsLock", "CapsLock"))
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(true)
        expect(s.get(toggleKeyAtom("NumLock"))).toBe(false)

        mockLockState.NumLock = true
        eventHandler(makeKeyEvent("keydown", "NumLock", "NumLock"))
        expect(s.get(toggleKeyAtom("NumLock"))).toBe(true)
    })

    test("does not update locks on non-lock keys after initialization", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))

        mockLockState.CapsLock = true
        eventHandler(makeKeyEvent("keydown", "KeyB", "b"))
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(false)
    })

    test("clearAllPressed resets initialization so next event re-seeds", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(false)

        clearAllPressed()
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(null)

        mockLockState.CapsLock = true
        eventHandler(makeKeyEvent("keydown", "KeyA", "A"))
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(true)
    })

    test("toggle keys never appear in pressedKeys", () => {
        const s = store()
        eventHandler(makeKeyEvent("keydown", "KeyA", "a"))

        mockLockState.CapsLock = true
        eventHandler(makeKeyEvent("keydown", "CapsLock", "CapsLock"))
        expect(s.get(toggleKeyAtom("CapsLock"))).toBe(true)
        expect(s.get(pressedCodesSelector)).toEqual(["KeyA"])

        eventHandler(makeKeyEvent("keyup", "CapsLock", "CapsLock"))
        expect(s.get(pressedCodesSelector)).toEqual(["KeyA"])
    })
})
