import { describe, test, expect, afterEach, beforeEach } from "bun:test"
import { permissionAtom } from "../atoms/permissionAtom"
import { requestMotionPermission } from "./requestMotionPermission"

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

describe("requestMotionPermission", () => {
    beforeEach(() => {
        permissionAtom.resetSelf()
    })

    afterEach(() => {
        setDeviceMotionEvent(originalDeviceMotionEvent)
        permissionAtom.resetSelf()
    })

    test("returns unsupported when DeviceMotionEvent is missing", async () => {
        setDeviceMotionEvent(undefined)
        await expect(requestMotionPermission()).resolves.toBe("unsupported")
    })

    test("returns granted on non-iOS browsers", async () => {
        setDeviceMotionEvent(class {})
        await expect(requestMotionPermission()).resolves.toBe("granted")
    })

    test("returns granted when iOS-style requestPermission resolves granted", async () => {
        const E = class {
            static requestPermission() {
                return Promise.resolve("granted" as PermissionState)
            }
        }
        setDeviceMotionEvent(E)
        await expect(requestMotionPermission()).resolves.toBe("granted")
    })

    test("returns denied when iOS-style requestPermission resolves denied", async () => {
        const E = class {
            static requestPermission() {
                return Promise.resolve("denied" as PermissionState)
            }
        }
        setDeviceMotionEvent(E)
        await expect(requestMotionPermission()).resolves.toBe("denied")
    })

    test("returns denied when iOS-style requestPermission rejects", async () => {
        const E = class {
            static requestPermission() {
                return Promise.reject(new Error("user gesture required"))
            }
        }
        setDeviceMotionEvent(E)
        await expect(requestMotionPermission()).resolves.toBe("denied")
    })
})
