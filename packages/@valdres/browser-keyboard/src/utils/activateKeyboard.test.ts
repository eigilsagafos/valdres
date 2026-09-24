import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "../../test/setup/keyboardHarness"
import { keyboardAtom } from "../atoms/keyboardAtom"
import { pressedCodesSelector } from "../selectors/pressedCodesSelector"
import { activateKeyboard } from "./activateKeyboard"

let kb: KeyboardHarness
beforeEach(() => {
    kb = installKeyboardHarness()
})
afterEach(() => {
    kb.restore()
})

describe("activateKeyboard", () => {
    test("starts tracking before any store subscribes, observable by a dormant read", () => {
        const app = store()
        activateKeyboard()
        expect(kb.physical()).toBe(4)
        expect(kb.invalidators()).toBe(0)

        kb.down("ShiftLeft", "Shift")
        expect(app.get(pressedCodesSelector)).toEqual(["ShiftLeft"])
        expect(kb.physical()).toBe(4)
        app.dispose()
    })

    test("is idempotent and shares the hub a later subscription uses", () => {
        activateKeyboard()
        activateKeyboard()
        kb.down("KeyA", "a")

        const app = store()
        const seen: string[] = []
        app.sub(keyboardAtom, () =>
            seen.push(app.get(pressedCodesSelector).join("+")),
        )
        expect(kb.physical()).toBe(4)
        expect(kb.invalidators()).toBe(1)

        kb.down("KeyB", "b")
        expect(seen).toEqual(["KeyA+KeyB"])
        app.dispose()
    })

    test("returns nothing to tear down", () => {
        expect(activateKeyboard()).toBeUndefined()
    })
})
