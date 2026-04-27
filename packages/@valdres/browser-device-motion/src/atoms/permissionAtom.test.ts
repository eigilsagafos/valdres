import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { store } from "valdres"
import { permissionAtom } from "./permissionAtom"

const originalDeviceMotionEvent = (
    globalThis as unknown as { DeviceMotionEvent?: unknown }
).DeviceMotionEvent

const setDeviceMotionEvent = (value: unknown) => {
    Object.defineProperty(globalThis, "DeviceMotionEvent", {
        value,
        configurable: true,
    })
    Object.defineProperty(window, "DeviceMotionEvent", {
        value,
        configurable: true,
    })
}

describe("permissionAtom", () => {
    afterEach(() => {
        setDeviceMotionEvent(originalDeviceMotionEvent)
        permissionAtom.resetSelf()
    })

    beforeEach(() => {
        permissionAtom.resetSelf()
    })

    test("reports unsupported when DeviceMotionEvent is missing", () => {
        setDeviceMotionEvent(undefined)
        const s = store()
        expect(s.get(permissionAtom)).toBe("unsupported")
    })

    test("reports prompt on iOS-style API (requestPermission present)", () => {
        const E = class {
            static requestPermission() {
                return Promise.resolve("granted" as PermissionState)
            }
        }
        setDeviceMotionEvent(E)
        const s = store()
        expect(s.get(permissionAtom)).toBe("prompt")
    })

    test("reports granted on browsers without requestPermission", () => {
        const E = class {}
        setDeviceMotionEvent(E)
        const s = store()
        expect(s.get(permissionAtom)).toBe("granted")
    })
})
