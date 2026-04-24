import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { store } from "valdres"
import { positionAtom } from "./positionAtom"
import { geolocationStatusAtom } from "./geolocationStatusAtom"
import { geolocationErrorAtom } from "./geolocationErrorAtom"
import { geolocationOptionsAtom } from "./geolocationOptionsAtom"

type SuccessCb = (position: GeolocationPosition) => void
type ErrorCb = (error: GeolocationPositionError) => void

type FakeGeolocation = {
    watchPosition: (
        success: SuccessCb,
        error?: ErrorCb,
        options?: PositionOptions,
    ) => number
    clearWatch: (id: number) => void
    _success?: SuccessCb
    _error?: ErrorCb
    _options?: PositionOptions
    _cleared: number[]
    _nextId: number
}

const makeGeolocation = (): FakeGeolocation => {
    const geo: FakeGeolocation = {
        _cleared: [],
        _nextId: 1,
        watchPosition: (success, error, options) => {
            geo._success = success
            geo._error = error
            geo._options = options
            return geo._nextId++
        },
        clearWatch: id => {
            geo._cleared.push(id)
        },
    }
    return geo
}

const setGeolocation = (value: unknown) => {
    Object.defineProperty(navigator, "geolocation", {
        value,
        configurable: true,
    })
}

const makePosition = (): GeolocationPosition =>
    ({
        coords: {
            latitude: 59.9139,
            longitude: 10.7522,
            accuracy: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        },
        timestamp: 1_700_000_000_000,
    }) as GeolocationPosition

describe("positionAtom", () => {
    let geo: FakeGeolocation

    beforeEach(() => {
        geo = makeGeolocation()
        setGeolocation(geo)
        positionAtom.resetSelf()
        geolocationStatusAtom.resetSelf()
        geolocationErrorAtom.resetSelf()
        geolocationOptionsAtom.resetSelf()
    })

    afterEach(() => {
        setGeolocation(null)
        positionAtom.resetSelf()
        geolocationStatusAtom.resetSelf()
        geolocationErrorAtom.resetSelf()
        geolocationOptionsAtom.resetSelf()
    })

    test("calls watchPosition on first read and sets status to pending", () => {
        const s = store()
        s.get(positionAtom)
        expect(typeof geo._success).toBe("function")
        expect(s.get(geolocationStatusAtom)).toBe("pending")
    })

    test("success updates position and marks status active", () => {
        const s = store()
        s.get(positionAtom)
        geo._success?.(makePosition())

        const snapshot = s.get(positionAtom)
        expect(snapshot?.latitude).toBe(59.9139)
        expect(snapshot?.longitude).toBe(10.7522)
        expect(s.get(geolocationStatusAtom)).toBe("active")
        expect(s.get(geolocationErrorAtom)).toBeNull()
    })

    test("permission-denied error sets status to error and preserves code", () => {
        const s = store()
        s.get(positionAtom)
        const err = {
            code: 1,
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
        } as GeolocationPositionError
        geo._error?.(err)

        expect(s.get(geolocationStatusAtom)).toBe("error")
        expect(s.get(geolocationErrorAtom)?.code).toBe(1)
    })

    test("position-unavailable error sets status to error", () => {
        const s = store()
        s.get(positionAtom)
        const err = {
            code: 2,
            message: "Position unavailable",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
        } as GeolocationPositionError
        geo._error?.(err)

        expect(s.get(geolocationStatusAtom)).toBe("error")
        expect(s.get(geolocationErrorAtom)?.code).toBe(2)
    })

    test("missing geolocation API marks status unsupported", () => {
        setGeolocation(null)
        const s = store()
        s.get(positionAtom)
        expect(s.get(geolocationStatusAtom)).toBe("unsupported")
    })

    test("options change restarts the watch with the new options", () => {
        const s = store()
        s.get(positionAtom)
        expect(geo._options?.enableHighAccuracy).toBe(false)
        const firstId = geo._cleared.length

        geolocationOptionsAtom.setSelf({
            enableHighAccuracy: true,
            timeout: 5_000,
            maximumAge: 1_000,
        })

        expect(geo._cleared.length).toBe(firstId + 1)
        expect(geo._options?.enableHighAccuracy).toBe(true)
        expect(geo._options?.timeout).toBe(5_000)
        expect(geo._options?.maximumAge).toBe(1_000)
    })
})
