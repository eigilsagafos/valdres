/**
 * Every public read name, driven by real document events through the hub.
 * Subscriber callbacks record what they observe before any diagnostic read,
 * and expectations are literal values, not re-derived from the store.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store, type State, type Store } from "valdres"
import {
    isCodePressedSelector,
    isKeyPressedSelector,
    keyboardAtom,
    modifierSelector,
    pressedCodesSelector,
    pressedKeysSelector,
    pressedKeyValuesSelector,
    toggleKeySelector,
    type PressedKey,
} from "../src/index"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "./setup/keyboardHarness"

let kb: KeyboardHarness
let app: Store
beforeEach(() => {
    kb = installKeyboardHarness()
    app = store()
})
afterEach(() => {
    app.dispose()
    kb.restore()
})

const record = <Value>(state: State<Value>) => {
    const seen: Value[] = []
    const stop = app.sub(state, () => seen.push(app.get(state)))
    return { seen, stop }
}

describe("pressed keys", () => {
    test("codes and lowercased key values follow presses and releases", () => {
        const codes = record<readonly string[]>(pressedCodesSelector)
        const keys = record<readonly string[]>(pressedKeyValuesSelector)

        kb.down("ShiftLeft", "Shift")
        kb.down("KeyA", "A", { shiftKey: true })
        kb.up("ShiftLeft", "Shift")
        kb.up("KeyA", "a")

        expect(codes.seen).toEqual([
            ["ShiftLeft"],
            ["ShiftLeft", "KeyA"],
            ["KeyA"],
            [],
        ])
        expect(keys.seen).toEqual([["shift"], ["shift", "a"], ["a"], []])
        codes.stop()
        keys.stop()
    })

    test("pressedKeysSelector keeps the first press's entry across repeats", () => {
        const pressed = record<readonly PressedKey[]>(pressedKeysSelector)
        const first = kb.down("KeyA", "a")
        kb.down("KeyA", "a", { repeat: true })
        kb.down("KeyA", "a", { repeat: true })

        expect(pressed.seen).toHaveLength(1)
        expect(pressed.seen[0]).toEqual([
            { code: "KeyA", key: "a", timeStamp: first.timeStamp },
        ])
        pressed.stop()
    })

    test("a repeat publishes nothing and keeps snapshot identity", () => {
        let notifications = 0
        const stop = app.sub(keyboardAtom, () => notifications++)
        kb.down("KeyA", "a")
        const before = app.get(keyboardAtom)
        kb.down("KeyA", "a", { repeat: true })
        kb.up("KeyZ", "z")
        expect(notifications).toBe(1)
        expect(app.get(keyboardAtom)).toBe(before)
        stop()
    })

    test("a lock-only change does not notify pressed-key subscribers", () => {
        kb.setLock("CapsLock", false)
        const codes = record<readonly string[]>(pressedCodesSelector)
        const caps = record<boolean | null>(toggleKeySelector("CapsLock"))
        kb.down("KeyA", "a")
        kb.setLock("CapsLock", true)
        kb.down("CapsLock", "CapsLock")

        expect(codes.seen).toEqual([["KeyA"]])
        expect(caps.seen).toEqual([false, true])
        codes.stop()
        caps.stop()
    })

    test("isCodePressedSelector and isKeyPressedSelector", () => {
        const code = record<boolean>(isCodePressedSelector("KeyA"))
        const key = record<boolean>(isKeyPressedSelector("A"))

        kb.down("KeyA", "a")
        kb.down("KeyB", "b")
        kb.up("KeyA", "A")

        expect(code.seen).toEqual([true, false])
        expect(key.seen).toEqual([true, false])
        expect(isCodePressedSelector("KeyA")).toBe(
            isCodePressedSelector("KeyA"),
        )
        code.stop()
        key.stop()
    })
})

describe("modifierSelector", () => {
    test("either side counts, and release clears", () => {
        const shift = record<boolean>(modifierSelector("shift"))
        const ctrl = record<boolean>(modifierSelector("ctrl"))

        kb.down("ShiftRight", "Shift")
        kb.down("ShiftLeft", "Shift")
        kb.up("ShiftRight", "Shift")
        kb.up("ShiftLeft", "Shift")
        kb.down("ControlLeft", "Control")

        expect(shift.seen).toEqual([true, false])
        expect(ctrl.seen).toEqual([true])
        shift.stop()
        ctrl.stop()
    })

    test("a modifier held before activation is not inferred from event flags", () => {
        const ctrl = record<boolean>(modifierSelector("ctrl"))
        const meta = record<boolean>(modifierSelector("meta"))

        kb.down("KeyS", "s", { ctrlKey: true, metaKey: true })

        expect(ctrl.seen).toEqual([])
        expect(meta.seen).toEqual([])
        expect(app.get(modifierSelector("ctrl"))).toBe(false)
        ctrl.stop()
        meta.stop()
    })
})

describe("toggleKeySelector", () => {
    test("null until the first event, seeded together, reset by focus loss", () => {
        kb.setLock("CapsLock", true)
        kb.setLock("NumLock", true)
        const caps = record<boolean | null>(toggleKeySelector("CapsLock"))
        const num = record<boolean | null>(toggleKeySelector("NumLock"))
        const scroll = record<boolean | null>(toggleKeySelector("ScrollLock"))
        expect(app.get(toggleKeySelector("CapsLock"))).toBe(null)

        kb.down("KeyA", "A")
        kb.blur()
        kb.setLock("CapsLock", false)
        kb.down("KeyA", "a")

        expect(caps.seen).toEqual([true, null, false])
        expect(num.seen).toEqual([true, null, true])
        expect(scroll.seen).toEqual([false, null, false])
        caps.stop()
        num.stop()
        scroll.stop()
    })

    test("lock keys update their own lock and never count as pressed", () => {
        const caps = record<boolean | null>(toggleKeySelector("CapsLock"))
        const codes = record<readonly string[]>(pressedCodesSelector)
        kb.down("KeyA", "a")

        kb.setLock("CapsLock", true)
        kb.down("CapsLock", "CapsLock")
        kb.up("CapsLock", "CapsLock")

        expect(caps.seen).toEqual([false, true])
        expect(codes.seen).toEqual([["KeyA"]])
        expect(app.get(pressedCodesSelector)).toEqual(["KeyA"])
        caps.stop()
        codes.stop()
    })
})

describe("macOS Meta recovery through the hub", () => {
    const withPlatform = (platform: string, fn: () => void) => {
        const original = navigator.platform
        Object.defineProperty(navigator, "platform", {
            value: platform,
            configurable: true,
        })
        try {
            fn()
        } finally {
            Object.defineProperty(navigator, "platform", {
                value: original,
                configurable: true,
            })
        }
    }

    test("keys pressed under Meta are truncated and Meta keyup clears all", () => {
        withPlatform("MacIntel", () => {
            const codes = record<readonly string[]>(pressedCodesSelector)
            kb.down("MetaLeft", "Meta")
            kb.down("KeyA", "a")
            kb.down("KeyB", "b")
            kb.up("MetaLeft", "Meta")
            expect(codes.seen).toEqual([
                ["MetaLeft"],
                ["MetaLeft", "KeyA"],
                ["MetaLeft", "KeyB"],
                [],
            ])
            codes.stop()
        })
    })

    test("other platforms keep every key", () => {
        withPlatform("Win32", () => {
            const codes = record<readonly string[]>(pressedCodesSelector)
            kb.down("MetaLeft", "Meta")
            kb.down("KeyA", "a")
            kb.down("KeyB", "b")
            expect(codes.seen.at(-1)).toEqual(["MetaLeft", "KeyA", "KeyB"])
            codes.stop()
        })
    })
})

describe("IME composition through the hub", () => {
    test("composing keydowns are ignored; a composing keyup releases a tracked key", () => {
        const codes = record<readonly string[]>(pressedCodesSelector)
        kb.down("ShiftLeft", "Shift")
        kb.down("KeyA", "Process", { keyCode: 229 })
        kb.down("KeyB", "b", { isComposing: true })
        kb.up("ShiftLeft", "Shift", { isComposing: true })
        expect(codes.seen).toEqual([["ShiftLeft"], []])
        codes.stop()
    })
})

describe("events from focused elements", () => {
    test("keys typed into an input bubble to the document hub", () => {
        const input = document.createElement("input")
        document.body.append(input)
        try {
            const codes = record<readonly string[]>(pressedCodesSelector)
            kb.down("KeyA", "a", { target: input })
            expect(codes.seen).toEqual([["KeyA"]])
            codes.stop()
        } finally {
            input.remove()
        }
    })
})
