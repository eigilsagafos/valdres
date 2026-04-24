import { describe, expect, test } from "bun:test"
import { store } from "valdres"
import { screensAtom } from "./screensAtom"

describe("screensAtom", () => {
    test("initial value is an empty array until requestScreenDetails resolves", () => {
        const s = store()
        expect(s.get(screensAtom)).toEqual([])
    })

    test("setSelf updates the global value", () => {
        const s = store()
        screensAtom.setSelf([
            {
                label: "External",
                left: 1440,
                top: 0,
                width: 2560,
                height: 1440,
                availLeft: 1440,
                availTop: 0,
                availWidth: 2560,
                availHeight: 1440,
                colorDepth: 24,
                pixelDepth: 24,
                devicePixelRatio: 1,
                orientationType: "landscape-primary",
                orientationAngle: 0,
                isPrimary: false,
                isInternal: false,
            },
        ])
        expect(s.get(screensAtom)[0].label).toBe("External")
    })
})
