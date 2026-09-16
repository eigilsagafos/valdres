import { beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { mouseInsideAtom } from "./mouseInsideAtom"

describe("mouseInsideAtom", () => {
    beforeEach(() => {
        mouseInsideAtom.resetSelf()
    })

    test("starts false", () => {
        const s = store()
        expect(s.get(mouseInsideAtom)).toBe(false)
    })

    test("flips on enter and leave", () => {
        const s = store()
        const unsub = s.sub(mouseInsideAtom, () => {})

        document.dispatchEvent(new MouseEvent("mouseenter"))
        expect(s.get(mouseInsideAtom)).toBe(true)

        document.dispatchEvent(new MouseEvent("mouseleave"))
        expect(s.get(mouseInsideAtom)).toBe(false)
        unsub()
    })

    test("stops tracking after the last subscriber leaves", () => {
        const s = store()
        const unsub = s.sub(mouseInsideAtom, () => {})
        unsub()

        document.dispatchEvent(new MouseEvent("mouseenter"))
        expect(s.get(mouseInsideAtom)).toBe(false)
    })
})
