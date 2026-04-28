import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { store } from "valdres"
import { permissionAtom } from "./permissionAtom"

const originalDeviceOrientationEvent = (
    globalThis as unknown as { DeviceOrientationEvent?: unknown }
).DeviceOrientationEvent

const setDeviceOrientationEvent = (value: unknown) => {
    Object.defineProperty(globalThis, "DeviceOrientationEvent", {
        value,
        configurable: true,
    })
    Object.defineProperty(window, "DeviceOrientationEvent", {
        value,
        configurable: true,
    })
}

describe("permissionAtom", () => {
    afterEach(() => {
        setDeviceOrientationEvent(originalDeviceOrientationEvent)
        permissionAtom.resetSelf()
    })

    beforeEach(() => {
        permissionAtom.resetSelf()
    })

    test("reports unsupported when DeviceOrientationEvent is missing", () => {
        setDeviceOrientationEvent(undefined)
        const s = store()
        expect(s.get(permissionAtom)).toBe("unsupported")
    })

    test("reports prompt on iOS-style API (requestPermission present)", () => {
        const E = class {
            static requestPermission() {
                return Promise.resolve("granted" as PermissionState)
            }
        }
        setDeviceOrientationEvent(E)
        const s = store()
        expect(s.get(permissionAtom)).toBe("prompt")
    })

    test("reports granted on browsers without requestPermission", () => {
        const E = class {}
        setDeviceOrientationEvent(E)
        const s = store()
        expect(s.get(permissionAtom)).toBe("granted")
    })
})
