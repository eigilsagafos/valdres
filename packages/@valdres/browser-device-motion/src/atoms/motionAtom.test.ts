import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { store } from "valdres"
import { motionAtom } from "./motionAtom"
import { motionStatusAtom } from "./motionStatusAtom"

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

class FakeDeviceMotionEvent extends Event {
    acceleration: DeviceMotionEventAcceleration | null
    accelerationIncludingGravity: DeviceMotionEventAcceleration | null
    rotationRate: DeviceMotionEventRotationRate | null
    interval: number
    constructor(
        type: string,
        init: {
            acceleration?: DeviceMotionEventAcceleration | null
            accelerationIncludingGravity?: DeviceMotionEventAcceleration | null
            rotationRate?: DeviceMotionEventRotationRate | null
            interval?: number
        } = {},
    ) {
        super(type)
        this.acceleration = init.acceleration ?? null
        this.accelerationIncludingGravity = init.accelerationIncludingGravity ?? null
        this.rotationRate = init.rotationRate ?? null
        this.interval = init.interval ?? 16
    }
}

describe("motionAtom", () => {
    let activeUnsubs: Array<() => void> = []

    beforeEach(() => {
        setDeviceMotionEvent(FakeDeviceMotionEvent)
        motionAtom.resetSelf()
        motionStatusAtom.resetSelf()
    })

    afterEach(() => {
        for (const unsub of activeUnsubs) unsub()
        activeUnsubs = []
        setDeviceMotionEvent(originalDeviceMotionEvent)
        motionAtom.resetSelf()
        motionStatusAtom.resetSelf()
    })

    test("subscribing attaches the devicemotion listener and marks status active", () => {
        const s = store()
        const unsub = s.sub(motionAtom, () => {})
        activeUnsubs.push(unsub)
        expect(s.get(motionStatusAtom)).toBe("active")
    })

    test("dispatched events update the snapshot", () => {
        const s = store()
        const unsub = s.sub(motionAtom, () => {})
        activeUnsubs.push(unsub)

        window.dispatchEvent(
            new FakeDeviceMotionEvent("devicemotion", {
                acceleration: { x: 0.1, y: 0.2, z: 0.3 },
                accelerationIncludingGravity: { x: 0.4, y: 0.5, z: 9.8 },
                rotationRate: { alpha: 1, beta: 2, gamma: 3 },
                interval: 16,
            }),
        )

        const snapshot = s.get(motionAtom)
        expect(snapshot?.acceleration?.x).toBe(0.1)
        expect(snapshot?.accelerationIncludingGravity?.z).toBe(9.8)
        expect(snapshot?.rotationRate?.beta).toBe(2)
        expect(snapshot?.interval).toBe(16)
    })

    test("unsubscribing detaches the listener and clears the snapshot", () => {
        const s = store()
        const unsub = s.sub(motionAtom, () => {})
        window.dispatchEvent(
            new FakeDeviceMotionEvent("devicemotion", {
                acceleration: { x: 1, y: 1, z: 1 },
            }),
        )
        expect(s.get(motionAtom)?.acceleration?.x).toBe(1)

        unsub()

        window.dispatchEvent(
            new FakeDeviceMotionEvent("devicemotion", {
                acceleration: { x: 99, y: 99, z: 99 },
            }),
        )
        expect(s.get(motionAtom)).toBeNull()
        expect(s.get(motionStatusAtom)).toBe("idle")
    })

    test("missing DeviceMotionEvent marks status unsupported", () => {
        setDeviceMotionEvent(undefined)
        const s = store()
        const unsub = s.sub(motionAtom, () => {})
        activeUnsubs.push(unsub)
        expect(s.get(motionStatusAtom)).toBe("unsupported")
    })
})
