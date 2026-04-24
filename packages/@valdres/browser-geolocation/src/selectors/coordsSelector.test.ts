import { describe, test, expect, beforeEach } from "bun:test"
import { store } from "valdres"
import { coordsSelector } from "./coordsSelector"
import { positionAtom } from "../atoms/positionAtom"

const setGeolocation = (value: unknown) => {
    Object.defineProperty(navigator, "geolocation", {
        value,
        configurable: true,
    })
}

describe("coordsSelector", () => {
    beforeEach(() => {
        setGeolocation(null)
        positionAtom.resetSelf()
    })

    test("returns null when no position", () => {
        const s = store()
        expect(s.get(coordsSelector)).toBeNull()
    })

    test("returns {latitude, longitude} when position is set", () => {
        positionAtom.setSelf({
            latitude: 59.9139,
            longitude: 10.7522,
            accuracy: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            timestamp: 1_700_000_000_000,
        })
        const s = store()
        expect(s.get(coordsSelector)).toEqual({
            latitude: 59.9139,
            longitude: 10.7522,
        })
    })
})
