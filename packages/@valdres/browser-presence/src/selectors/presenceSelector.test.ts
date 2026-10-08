import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { focusAtom } from "@valdres/browser-focus"
import { isVisibleSelector, visibilityAtom } from "@valdres/browser-visibility"
import { installPageHarness, type PageHarness } from "../../test/setup/pageHarness"
import { presenceSelector } from "./presenceSelector"

let harness: PageHarness | undefined
const install = (state: { focused?: boolean; visible?: boolean } = {}) => {
    harness = installPageHarness()
    harness.setHasFocus(state.focused ?? true)
    harness.setVisibility(state.visible === false ? "hidden" : "visible")
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

/** Every listener the composition may own, by `target:type`. */
const attached = (page: PageHarness) => page.attached()

describe("presenceSelector", () => {
    test("a dormant read composes both samples without attaching anything", () => {
        const page = install({ focused: true, visible: true })
        const app = store()
        expect(app.get(presenceSelector)).toBe(true)

        page.setHasFocus(false)
        expect(app.get(presenceSelector)).toBe(false)
        page.setHasFocus(true)
        page.setVisibility("hidden")
        expect(app.get(presenceSelector)).toBe(false)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a subscriber retains exactly the focus and visibility sources, and nothing of its own", () => {
        const page = install()
        const app = store()

        const unsub = app.sub(presenceSelector, () => {})
        expect(attached(page)).toEqual({
            "window:focus": 1,
            "window:blur": 1,
            "document:visibilitychange": 1,
        })

        // Subscribing to the inputs directly in the same store reuses the same
        // definitions, so nothing attaches twice.
        const stopFocus = app.sub(focusAtom, () => {})
        const stopVisible = app.sub(isVisibleSelector, () => {})
        expect(page.physical()).toBe(3)

        stopFocus()
        stopVisible()
        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("follows focus and visibility in both directions", () => {
        const page = install()
        const app = store()
        const seen: boolean[] = []
        const unsub = app.sub(presenceSelector, () => seen.push(app.get(presenceSelector)))

        page.fire("window", "blur")
        page.fire("window", "focus")
        page.setVisibility("hidden")
        page.fire("document", "visibilitychange")
        page.setVisibility("visible")
        page.fire("document", "visibilitychange")
        expect(seen).toEqual([false, true, false, true])

        unsub()
        app.dispose()
    })

    test("is false while either input is lost and true only when both return", () => {
        const page = install()
        const app = store()
        let notifications = 0
        const unsub = app.sub(presenceSelector, () => notifications++)

        page.fire("window", "blur")
        page.setVisibility("hidden")
        page.fire("document", "visibilitychange")
        expect(app.get(presenceSelector)).toBe(false)
        // The first loss notified; the second changed an input, not presence.
        expect(notifications).toBe(1)

        page.fire("window", "focus")
        expect(app.get(presenceSelector)).toBe(false)
        page.setVisibility("visible")
        page.fire("document", "visibilitychange")
        expect(app.get(presenceSelector)).toBe(true)
        expect(notifications).toBe(2)

        unsub()
        app.dispose()
    })

    test("keeps the focus source attached while hidden", () => {
        const page = install()
        const app = store()
        const unsub = app.sub(presenceSelector, () => {})

        page.setVisibility("hidden")
        page.fire("document", "visibilitychange")
        expect(page.physical()).toBe(3)

        // A blur announced while hidden is not lost on the way back.
        page.fire("window", "blur")
        page.setVisibility("visible")
        page.fire("document", "visibilitychange")
        expect(app.get(presenceSelector)).toBe(false)
        expect(app.get(focusAtom)).toBe(false)

        unsub()
        app.dispose()
    })

    test("independent stores own their visibility listeners and share the focus hub", () => {
        const page = install()
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(presenceSelector, () => seen.push("first"))
        const stopSecond = second.sub(presenceSelector, () => seen.push("second"))
        expect(attached(page)).toEqual({
            "window:focus": 1,
            "window:blur": 1,
            "document:visibilitychange": 2,
        })

        page.fire("window", "blur")
        expect(seen).toEqual(["first", "second"])

        stopFirst()
        seen.length = 0
        page.fire("window", "focus")
        expect(seen).toEqual(["second"])
        expect(attached(page)).toEqual({
            "window:focus": 1,
            "window:blur": 1,
            "document:visibilitychange": 1,
        })

        stopSecond()
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a child scope shares its root's attachments", () => {
        const page = install()
        const app = store()
        const child = app.scope()
        const stopRoot = app.sub(presenceSelector, () => {})
        const stopChild = child.sub(presenceSelector, () => {})
        expect(page.physical()).toBe(3)

        page.fire("window", "blur")
        expect(child.get(presenceSelector)).toBe(false)

        stopChild()
        stopRoot()
        expect(page.physical()).toBe(0)
        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases both sources", () => {
        const page = install()
        const app = store()
        app.sub(presenceSelector, () => {})
        expect(page.physical()).toBe(3)

        app.dispose()
        expect(page.physical()).toBe(0)
    })

    test("is read-only", () => {
        install()
        const app = store()
        expect(() =>
            (app as unknown as { set: (...args: unknown[]) => void }).set(
                presenceSelector,
                false,
            ),
        ).toThrow(TypeError)
        expect(app.get(visibilityAtom)).toBe("visible")
        app.dispose()
    })
})
