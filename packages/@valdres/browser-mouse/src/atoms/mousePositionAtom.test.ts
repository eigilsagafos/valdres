import { beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { mousePositionAtom } from "./mousePositionAtom"

describe("mousePositionAtom", () => {
    beforeEach(() => {
        // The atom is global; reset so state from another test file doesn't bleed in.
        mousePositionAtom.resetSelf()
    })

    test("initial value is zeroed", () => {
        const s = store()
        expect(s.get(mousePositionAtom)).toEqual({
            clientX: 0,
            clientY: 0,
            pageX: 0,
            pageY: 0,
            screenX: 0,
            screenY: 0,
        })
    })

    test("updates when mousemove fires", () => {
        const s = store()
        const unsub = s.sub(mousePositionAtom, () => {})

        window.dispatchEvent(
            new MouseEvent("mousemove", {
                clientX: 12,
                clientY: 34,
                screenX: 112,
                screenY: 134,
            }),
        )

        const pos = s.get(mousePositionAtom)
        expect(pos.clientX).toBe(12)
        expect(pos.clientY).toBe(34)
        expect(pos.screenX).toBe(112)
        expect(pos.screenY).toBe(134)
        // pageX/pageY are intentionally not asserted: happy-dom's MouseEvent
        // implements neither, so they always read 0 here regardless of the
        // event init. They are exercised by the real browser, not this suite —
        // don't add an assertion that would only ever verify 0 === 0.
        unsub()
    })

    test("stops updating after the last subscriber leaves", () => {
        const s = store()
        const unsub = s.sub(mousePositionAtom, () => {})
        window.dispatchEvent(new MouseEvent("mousemove", { clientX: 5 }))
        expect(s.get(mousePositionAtom).clientX).toBe(5)

        unsub()
        window.dispatchEvent(new MouseEvent("mousemove", { clientX: 99 }))
        expect(s.get(mousePositionAtom).clientX).toBe(5)
    })
})
