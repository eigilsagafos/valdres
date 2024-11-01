import { describe, test, expect } from "bun:test"
import { store } from "valdres"
import { mockWindow } from "../test/mockWindow"
import { userSelectedColorModeAtom } from "./userSelectedColorModeAtom"
import { colorModeSelector } from "./colorModeSelector"
import { systemColorModeAtom } from "./systemColorModeAtom"

describe("userSelectedColorModeAtom", () => {
    test("default", () => {
        const { togglePrefersColorScheme, eventListeners } = mockWindow()
        const rootStore = store()
        expect(rootStore.get(userSelectedColorModeAtom)).toBe("system")
        expect(rootStore.get(colorModeSelector)).toBe("dark")
        togglePrefersColorScheme()
        expect(rootStore.get(colorModeSelector)).toBe("light")
        rootStore.set(userSelectedColorModeAtom, "dark")
        expect(rootStore.get(colorModeSelector)).toBe("dark")
        expect(rootStore.get(userSelectedColorModeAtom)).toBe("dark")
        expect(rootStore.get(systemColorModeAtom)).toBe("light")
    })
})
