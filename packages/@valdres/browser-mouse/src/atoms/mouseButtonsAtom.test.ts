import { beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { mouseButtonsAtom } from "./mouseButtonsAtom"

describe("mouseButtonsAtom", () => {
    beforeEach(() => {
        mouseButtonsAtom.resetSelf()
    })

    test("initial value has nothing pressed", () => {
        const s = store()
        expect(s.get(mouseButtonsAtom)).toEqual({
            buttons: 0,
            left: false,
            right: false,
            middle: false,
        })
    })

    test("tracks press and release", () => {
        const s = store()
        const unsub = s.sub(mouseButtonsAtom, () => {})

        window.dispatchEvent(new MouseEvent("mousedown", { buttons: 1 }))
        expect(s.get(mouseButtonsAtom).left).toBe(true)

        window.dispatchEvent(new MouseEvent("mouseup", { buttons: 0 }))
        expect(s.get(mouseButtonsAtom).left).toBe(false)
        unsub()
    })

    test("shows the right button while held, then clears on the next move", () => {
        const s = store()
        const unsub = s.sub(mouseButtonsAtom, () => {})

        // Right-click shows the press; the native context menu then swallows the
        // mouseup, so the next mousemove (buttons === 0) is what resyncs it.
        window.dispatchEvent(new MouseEvent("mousedown", { buttons: 2 }))
        expect(s.get(mouseButtonsAtom).right).toBe(true)

        window.dispatchEvent(new MouseEvent("mousemove", { buttons: 0 }))
        expect(s.get(mouseButtonsAtom).right).toBe(false)
        unsub()
    })

    test("mousemove with an unchanged bitmask does not write a new state", () => {
        const s = store()
        const unsub = s.sub(mouseButtonsAtom, () => {})

        const before = s.get(mouseButtonsAtom)
        window.dispatchEvent(new MouseEvent("mousemove", { buttons: 0 }))
        // Same reference => the guard skipped setSelf, so no churn per pixel.
        expect(s.get(mouseButtonsAtom)).toBe(before)
        unsub()
    })

    test("clears stuck buttons when the window loses focus", () => {
        const s = store()
        const unsub = s.sub(mouseButtonsAtom, () => {})

        window.dispatchEvent(new MouseEvent("mousedown", { buttons: 1 }))
        expect(s.get(mouseButtonsAtom).left).toBe(true)

        window.dispatchEvent(new Event("blur"))
        expect(s.get(mouseButtonsAtom).left).toBe(false)
        unsub()
    })

    test("stops tracking after the last subscriber leaves", () => {
        const s = store()
        const unsub = s.sub(mouseButtonsAtom, () => {})
        unsub()

        window.dispatchEvent(new MouseEvent("mousedown", { buttons: 1 }))
        expect(s.get(mouseButtonsAtom).left).toBe(false)
    })
})
