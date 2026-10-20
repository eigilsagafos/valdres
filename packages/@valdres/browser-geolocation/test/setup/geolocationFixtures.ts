import { forgetGeolocationPermission } from "../../src/lib/geolocationPermission"
import { installDeviceHarness, type DeviceHarness } from "./deviceHarness"

export interface FakeWatch {
    readonly id: number
    readonly success: PositionCallback
    readonly error: PositionErrorCallback | null | undefined
    readonly options: PositionOptions | undefined
    /** Whether the watch was started with transient user activation. */
    readonly activated: boolean
    cleared: boolean
}

/**
 * A scripted `navigator.geolocation`: it never touches a real location. Tests
 * drive each watch's callbacks directly, including watches already cleared, to
 * model reports the platform delivers late.
 */
export interface FakeGeolocation {
    readonly watches: FakeWatch[]
    /** Watches not cleared yet. */
    live(): FakeWatch[]
    /** Makes the next `watchPosition` throw. */
    failNext: unknown
}

export const position = (
    latitude: number,
    longitude = 10.75,
    timestamp = 1_700_000_000_000,
): GeolocationPosition =>
    ({
        coords: {
            latitude,
            longitude,
            accuracy: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        },
        timestamp,
    }) as GeolocationPosition

export const positionError = (code: 1 | 2 | 3, message = `code ${code}`) =>
    ({
        code,
        message,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
    }) as GeolocationPositionError

export const installGeolocation = (): DeviceHarness & {
    readonly geolocation: FakeGeolocation
} => {
    const harness = installDeviceHarness()
    forgetGeolocationPermission()
    let nextId = 1
    const geolocation: FakeGeolocation = {
        watches: [],
        live: () => geolocation.watches.filter(watch => !watch.cleared),
        failNext: undefined,
    }
    const api = {
        watchPosition: (
            success: PositionCallback,
            error?: PositionErrorCallback | null,
            options?: PositionOptions,
        ) => {
            if (geolocation.failNext !== undefined) {
                const failure = geolocation.failNext
                geolocation.failNext = undefined
                throw failure
            }
            const watch: FakeWatch = {
                id: nextId++,
                success,
                error,
                options,
                activated: harness.hasActivation(),
                cleared: false,
            }
            geolocation.watches.push(watch)
            return watch.id
        },
        clearWatch: (id: number) => {
            const watch = geolocation.watches.find(candidate => candidate.id === id)
            if (watch !== undefined) watch.cleared = true
        },
        getCurrentPosition: () => {
            throw new Error("the package must not call getCurrentPosition")
        },
    }
    Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: api,
    })
    harness.removePermissions()
    const restore = harness.restore
    return {
        ...harness,
        geolocation,
        restore: () => {
            forgetGeolocationPermission()
            Object.defineProperty(navigator, "geolocation", {
                configurable: true,
                value: undefined,
            })
            restore()
        },
    }
}
