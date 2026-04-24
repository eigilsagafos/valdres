import { describe, test, expect } from "bun:test"
import { toSnapshot } from "./toSnapshot"

const makePosition = (
    overrides: Partial<GeolocationCoordinates> = {},
): GeolocationPosition =>
    ({
        coords: {
            latitude: 59.9139,
            longitude: 10.7522,
            accuracy: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            ...overrides,
        },
        timestamp: 1_700_000_000_000,
    }) as GeolocationPosition

describe("toSnapshot", () => {
    test("flattens GeolocationPosition into a plain snapshot", () => {
        const snap = toSnapshot(makePosition())
        expect(snap).toEqual({
            latitude: 59.9139,
            longitude: 10.7522,
            accuracy: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            timestamp: 1_700_000_000_000,
        })
    })

    test("preserves optional motion fields when present", () => {
        const snap = toSnapshot(
            makePosition({ altitude: 142, heading: 90, speed: 3.5 }),
        )
        expect(snap.altitude).toBe(142)
        expect(snap.heading).toBe(90)
        expect(snap.speed).toBe(3.5)
    })
})
