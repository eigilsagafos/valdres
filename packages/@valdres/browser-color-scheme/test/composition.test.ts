/**
 * Exercises the app-owned composition documented in
 * `src/browser-color-scheme.mdx`: the package owns the OS preference, the
 * application owns the override, and a selector resolves the effective theme.
 * Nothing here belongs in the package — it is the shape consumers copy.
 */
import { afterEach, describe, expect, test } from "bun:test"
import { atom, selector, store } from "valdres"
import { colorSchemeAtom, type ColorScheme } from "../src/index"
import { COLOR_SCHEME_MEDIA } from "../src/lib/colorSchemeSource"
import { installMediaHarness, type MediaHarness } from "./setup/mediaHarness"

const DARK = COLOR_SCHEME_MEDIA

// --- application code -------------------------------------------------------
type ThemePreference = ColorScheme | "system"

const themePreferenceAtom = atom<ThemePreference>("system", {
    name: "app/themePreference",
})

const themeSelector = selector<ColorScheme>(
    get => {
        const preference = get(themePreferenceAtom)
        return preference === "system" ? get(colorSchemeAtom) : preference
    },
    { name: "app/theme" },
)
// ----------------------------------------------------------------------------

let harness: MediaHarness | undefined
afterEach(() => {
    harness?.restore()
    harness = undefined
})

describe("app-owned theme composition", () => {
    test("follows the OS while the preference is system and the picker wins otherwise", () => {
        harness = installMediaHarness({ [DARK]: true })
        const app = store()
        const seen: ColorScheme[] = []
        const unsub = app.sub(themeSelector, () => seen.push(app.get(themeSelector)))

        expect(app.get(themePreferenceAtom)).toBe("system")
        expect(app.get(themeSelector)).toBe("dark")

        harness.set(DARK, false)
        harness.change(DARK)
        expect(seen).toEqual(["light"])

        // The picker selects the preference, never the resolved mode.
        app.set(themePreferenceAtom, "dark")
        expect(app.get(themeSelector)).toBe("dark")
        expect(app.get(colorSchemeAtom)).toBe("light")

        app.set(themePreferenceAtom, "system")
        expect(app.get(themeSelector)).toBe("light")

        unsub()
        app.dispose()
    })

    test("pinning a theme detaches the OS listener and returning re-samples it", () => {
        harness = installMediaHarness({ [DARK]: false })
        const app = store()
        const unsub = app.sub(themeSelector, () => {})
        expect(harness.listeners(DARK)).toBe(1)

        // A pinned theme stops reading the source, so the listener is released.
        app.set(themePreferenceAtom, "dark")
        expect(harness.listeners(DARK)).toBe(0)

        // The OS flips while the source is dormant.
        harness.set(DARK, true)

        // Returning to "system" re-attaches and reports the current value, not
        // the value that was current when the source detached.
        app.set(themePreferenceAtom, "system")
        expect(harness.listeners(DARK)).toBe(1)
        expect(app.get(themeSelector)).toBe("dark")

        unsub()
        expect(harness.listeners(DARK)).toBe(0)
        expect(harness.created(DARK)).toBe(1)
        app.dispose()
    })

    test("two app roots hold independent preferences over one shared OS source", () => {
        harness = installMediaHarness({ [DARK]: true })
        const left = store()
        const right = store()
        const stopLeft = left.sub(themeSelector, () => {})
        const stopRight = right.sub(themeSelector, () => {})
        expect(harness.listeners(DARK)).toBe(2)

        left.set(themePreferenceAtom, "light")
        expect(left.get(themeSelector)).toBe("light")
        expect(right.get(themeSelector)).toBe("dark")
        // Pinning one root released only that root's listener.
        expect(harness.listeners(DARK)).toBe(1)

        stopLeft()
        stopRight()
        expect(harness.listeners(DARK)).toBe(0)
        left.dispose()
        right.dispose()
    })
})
