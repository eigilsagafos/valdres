import { afterEach, describe, expect, test } from "bun:test"
import { modifierOfKey, parseShortcut, parseShortcuts } from "./parseShortcut"

const setPlatform = (platform: string) =>
    Object.defineProperty(navigator, "platform", {
        value: platform,
        configurable: true,
    })
afterEach(() => setPlatform("Linux x86_64"))

describe("parseShortcut", () => {
    test("canonical ids ignore modifier order, spelling and letter case", () => {
        const ids = ["Shift+Ctrl+z", "control+SHIFT+Z", "ctrl+shift+Z"].map(
            s => parseShortcut(s).id,
        )
        expect(new Set(ids)).toEqual(new Set(["Ctrl+Shift+z"]))
    })

    test("Mod is Meta on Apple platforms and Control elsewhere", () => {
        setPlatform("Linux x86_64")
        expect(parseShortcut("Mod+s").id).toBe("Ctrl+s")
        setPlatform("MacIntel")
        expect(parseShortcut("Mod+s").id).toBe("Meta+s")
        expect(parseShortcut("Cmd+s").id).toBe("Meta+s")
        expect(parseShortcut("Option+Command+s").id).toBe("Alt+Meta+s")
    })

    test("code tokens keep their case; aliases normalise", () => {
        expect(parseShortcut("Alt+KeyK")).toMatchObject({
            trigger: "KeyK",
            key: "keyk",
        })
        expect(parseShortcut("Space")).toMatchObject({
            trigger: " ",
            key: " ",
            id: "Space",
        })
        expect(parseShortcut("esc")).toMatchObject({ key: "escape" })
        expect(parseShortcut("Up").key).toBe("arrowup")
        expect(parseShortcut("Return").key).toBe("enter")
        expect(parseShortcut("Backspace").key).toBe("backspace")
    })

    test("plus: as the trigger after a separator, alone, or by name", () => {
        expect(parseShortcut("Mod++")).toMatchObject({
            trigger: "+",
            id: "Ctrl++",
        })
        expect(parseShortcut("+").trigger).toBe("+")
        expect(parseShortcut("Ctrl+Plus").trigger).toBe("+")
    })

    test("shifted symbols ignore Shift; naming Shift with one is an error", () => {
        expect(parseShortcut("?").ignoreShift).toBe(true)
        expect(parseShortcut("a").ignoreShift).toBe(false)
        expect(parseShortcut("Shift+Digit1").ignoreShift).toBe(false)
        expect(() => parseShortcut("Shift+?")).toThrow(SyntaxError)
    })

    test("rejects empty shortcuts, unknown modifiers and empty lists", () => {
        expect(() => parseShortcut("")).toThrow(SyntaxError)
        expect(() => parseShortcut("Ctrl+")).toThrow(SyntaxError)
        expect(() => parseShortcut("Hyper+k")).toThrow(SyntaxError)
        expect(() => parseShortcut(1 as unknown as string)).toThrow(TypeError)
        expect(() => parseShortcuts([])).toThrow(TypeError)
        expect(parseShortcuts(["a", "b"]).map(s => s.id)).toEqual(["a", "b"])
    })

    test("modifierOfKey", () => {
        expect(
            ["Shift", "Control", "Alt", "Meta", "a"].map(modifierOfKey),
        ).toEqual(["shift", "ctrl", "alt", "meta", undefined])
    })
})
