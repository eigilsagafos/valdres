import { describe, expect, test } from "bun:test"
import { toScreenDetail } from "./toScreenDetail"

describe("toScreenDetail", () => {
    test("maps a full ScreenDetailed shape to a plain ScreenDetail", () => {
        const info = toScreenDetail({
            label: "Built-in Retina Display",
            left: 0,
            top: 0,
            width: 1440,
            height: 900,
            availLeft: 0,
            availTop: 25,
            availWidth: 1440,
            availHeight: 875,
            colorDepth: 30,
            pixelDepth: 30,
            devicePixelRatio: 2,
            orientation: { type: "landscape-primary", angle: 0 },
            isPrimary: true,
            isInternal: true,
        })

        expect(info).toEqual({
            label: "Built-in Retina Display",
            left: 0,
            top: 0,
            width: 1440,
            height: 900,
            availLeft: 0,
            availTop: 25,
            availWidth: 1440,
            availHeight: 875,
            colorDepth: 30,
            pixelDepth: 30,
            devicePixelRatio: 2,
            orientationType: "landscape-primary",
            orientationAngle: 0,
            isPrimary: true,
            isInternal: true,
        })
    })

    test("fills defaults for a bare window.screen shape", () => {
        const info = toScreenDetail({
            width: 1024,
            height: 768,
            availWidth: 1024,
            availHeight: 768,
            colorDepth: 24,
            pixelDepth: 24,
        })

        expect(info.label).toBe("")
        expect(info.left).toBe(0)
        expect(info.top).toBe(0)
        expect(info.isPrimary).toBe(true)
        expect(info.isInternal).toBe(true)
        expect(info.orientationType).toBe("landscape-primary")
    })
})
