import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { store } from "valdres"
import { orientationAtom } from "./orientationAtom"
import { orientationStatusAtom } from "./orientationStatusAtom"

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

class FakeDeviceOrientationEvent extends Event {
    alpha: number | null
    beta: number | null
    gamma: number | null
    absolute: boolean
    constructor(
        type: string,
        init: {
            alpha?: number | null
            beta?: number | null
            gamma?: number | null
            absolute?: boolean
        } = {},
    ) {
        super(type)
        this.alpha = init.alpha ?? null
        this.beta = init.beta ?? null
        this.gamma = init.gamma ?? null
        this.absolute = init.absolute ?? false
    }
}

describe("orientationAtom", () => {
    let activeUnsubs: Array<() => void> = []

    beforeEach(() => {
        setDeviceOrientationEvent(FakeDeviceOrientationEvent)
        orientationAtom.resetSelf()
        orientationStatusAtom.resetSelf()
    })

    afterEach(() => {
        for (const unsub of activeUnsubs) unsub()
        activeUnsubs = []
        setDeviceOrientationEvent(originalDeviceOrientationEvent)
        orientationAtom.resetSelf()
        orientationStatusAtom.resetSelf()
    })

    test("subscribing attaches the deviceorientation listener and marks status active", () => {
        const s = store()
        const unsub = s.sub(orientationAtom, () => {})
        activeUnsubs.push(unsub)
        expect(s.get(orientationStatusAtom)).toBe("active")
    })

    test("dispatched events update the snapshot", () => {
        const s = store()
        const unsub = s.sub(orientationAtom, () => {})
        activeUnsubs.push(unsub)

        window.dispatchEvent(
            new FakeDeviceOrientationEvent("deviceorientation", {
                alpha: 90,
                beta: 45,
                gamma: -30,
                absolute: true,
            }),
        )

        const snapshot = s.get(orientationAtom)
        expect(snapshot?.alpha).toBe(90)
        expect(snapshot?.beta).toBe(45)
        expect(snapshot?.gamma).toBe(-30)
        expect(snapshot?.absolute).toBe(true)
    })

    test("unsubscribing detaches the listener and clears the snapshot", () => {
        const s = store()
        const unsub = s.sub(orientationAtom, () => {})
        window.dispatchEvent(
            new FakeDeviceOrientationEvent("deviceorientation", { alpha: 10 }),
        )
        expect(s.get(orientationAtom)?.alpha).toBe(10)

        unsub()

        // After unsubscribe the listener should be gone — dispatching shouldn't
        // mutate the atom (and the cleanup also resets it to null).
        window.dispatchEvent(
            new FakeDeviceOrientationEvent("deviceorientation", { alpha: 99 }),
        )
        expect(s.get(orientationAtom)).toBeNull()
        expect(s.get(orientationStatusAtom)).toBe("idle")
    })

    test("missing DeviceOrientationEvent marks status unsupported", () => {
        setDeviceOrientationEvent(undefined)
        const s = store()
        const unsub = s.sub(orientationAtom, () => {})
        activeUnsubs.push(unsub)
        expect(s.get(orientationStatusAtom)).toBe("unsupported")
    })
})
