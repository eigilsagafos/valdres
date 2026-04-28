import { describe, expect, test } from "bun:test"
import { toSnapshot } from "./toSnapshot"

const buildEvent = (
    overrides: Partial<{
        alpha: number | null
        beta: number | null
        gamma: number | null
        absolute: boolean
        webkitCompassHeading: number | null
        webkitCompassAccuracy: number | null
        timeStamp: number
    }> = {},
) => {
    const event = {
        alpha: overrides.alpha ?? 90,
        beta: overrides.beta ?? 45,
        gamma: overrides.gamma ?? -30,
        absolute: overrides.absolute ?? true,
        timeStamp: overrides.timeStamp ?? 1234.5,
    } as DeviceOrientationEvent
    if ("webkitCompassHeading" in overrides) {
        ;(event as unknown as Record<string, unknown>).webkitCompassHeading =
            overrides.webkitCompassHeading
    }
    if ("webkitCompassAccuracy" in overrides) {
        ;(event as unknown as Record<string, unknown>).webkitCompassAccuracy =
            overrides.webkitCompassAccuracy
    }
    return event
}

describe("toSnapshot", () => {
    test("copies the spec fields verbatim", () => {
        const snapshot = toSnapshot(
            buildEvent({
                alpha: 12,
                beta: 34,
                gamma: -56,
                absolute: false,
                timeStamp: 999,
            }),
        )
        expect(snapshot.alpha).toBe(12)
        expect(snapshot.beta).toBe(34)
        expect(snapshot.gamma).toBe(-56)
        expect(snapshot.absolute).toBe(false)
        expect(snapshot.timeStamp).toBe(999)
    })

    test("defaults webkit fields to null on non-iOS browsers", () => {
        const snapshot = toSnapshot(buildEvent())
        expect(snapshot.webkitCompassHeading).toBeNull()
        expect(snapshot.webkitCompassAccuracy).toBeNull()
    })

    test("propagates iOS webkit compass fields when present", () => {
        const snapshot = toSnapshot(
            buildEvent({
                webkitCompassHeading: 271.4,
                webkitCompassAccuracy: 5,
            }),
        )
        expect(snapshot.webkitCompassHeading).toBe(271.4)
        expect(snapshot.webkitCompassAccuracy).toBe(5)
    })
})
