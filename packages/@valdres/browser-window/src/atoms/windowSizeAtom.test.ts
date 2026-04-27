import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { windowSizeAtom } from "./windowSizeAtom"

const setInner = (width: number, height: number) => {
    Object.defineProperty(window, "innerWidth", {
        value: width,
        configurable: true,
    })
    Object.defineProperty(window, "innerHeight", {
        value: height,
        configurable: true,
    })
}

describe("windowSizeAtom", () => {
    let originalInnerWidth: number
    let originalInnerHeight: number

    beforeEach(() => {
        originalInnerWidth = window.innerWidth
        originalInnerHeight = window.innerHeight
    })

    afterEach(() => {
        setInner(originalInnerWidth, originalInnerHeight)
    })

    test("initial value reflects window inner/outer size", () => {
        const s = store()
        const size = s.get(windowSizeAtom)
        expect(size.innerWidth).toBe(window.innerWidth)
        expect(size.innerHeight).toBe(window.innerHeight)
    })

    test("updates when window resize fires", () => {
        const s = store()
        const unsub = s.sub(windowSizeAtom, () => {})

        setInner(640, 480)
        window.dispatchEvent(new Event("resize"))

        const size = s.get(windowSizeAtom)
        expect(size.innerWidth).toBe(640)
        expect(size.innerHeight).toBe(480)
        unsub()
    })
})
