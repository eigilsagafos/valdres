import { describe, test, expect, afterEach, beforeEach } from "bun:test"
import { permissionAtom } from "../atoms/permissionAtom"
import { requestOrientationPermission } from "./requestOrientationPermission"

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

describe("requestOrientationPermission", () => {
    beforeEach(() => {
        permissionAtom.resetSelf()
    })

    afterEach(() => {
        setDeviceOrientationEvent(originalDeviceOrientationEvent)
        permissionAtom.resetSelf()
    })

    test("returns unsupported when DeviceOrientationEvent is missing", async () => {
        setDeviceOrientationEvent(undefined)
        await expect(requestOrientationPermission()).resolves.toBe("unsupported")
    })

    test("returns granted on non-iOS browsers without requiring user gesture", async () => {
        setDeviceOrientationEvent(class {})
        await expect(requestOrientationPermission()).resolves.toBe("granted")
    })

    test("returns granted when iOS-style requestPermission resolves granted", async () => {
        const E = class {
            static requestPermission() {
                return Promise.resolve("granted" as PermissionState)
            }
        }
        setDeviceOrientationEvent(E)
        await expect(requestOrientationPermission()).resolves.toBe("granted")
    })

    test("returns denied when iOS-style requestPermission resolves denied", async () => {
        const E = class {
            static requestPermission() {
                return Promise.resolve("denied" as PermissionState)
            }
        }
        setDeviceOrientationEvent(E)
        await expect(requestOrientationPermission()).resolves.toBe("denied")
    })

    test("preserves prompt when iOS-style requestPermission resolves prompt", async () => {
        const E = class {
            static requestPermission() {
                return Promise.resolve("prompt" as PermissionState)
            }
        }
        setDeviceOrientationEvent(E)
        await expect(requestOrientationPermission()).resolves.toBe("prompt")
    })

    test("preserves the current state when requestPermission rejects (transient errors like missing user gesture)", async () => {
        const E = class {
            static requestPermission() {
                return Promise.reject(new Error("user gesture required"))
            }
        }
        setDeviceOrientationEvent(E)
        permissionAtom.resetSelf()
        await expect(requestOrientationPermission()).resolves.toBe("prompt")
    })

    test("does not flip permission to denied on rejection — caller can retry", async () => {
        const E = class {
            static requestPermission() {
                return Promise.reject(new Error("not allowed"))
            }
        }
        setDeviceOrientationEvent(E)
        permissionAtom.resetSelf()
        await requestOrientationPermission()
        expect(permissionAtom.getSelf()).toBe("prompt")
    })
})
