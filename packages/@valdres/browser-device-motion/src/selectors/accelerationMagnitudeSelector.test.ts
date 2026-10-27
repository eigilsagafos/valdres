import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import type { DeviceHarness } from "../../test/setup/deviceHarness"
import {
    FakeDeviceMotionEvent,
    installMotion,
} from "../../test/setup/motionFixtures"
import { accelerationMagnitudeSelector } from "./accelerationMagnitudeSelector"

let harness: DeviceHarness | undefined
afterEach(() => {
    harness?.restore()
    harness = undefined
})

const magnitudeAfter = (
    acceleration: DeviceMotionEventAcceleration | null,
): number | null => {
    harness = installMotion()
    const app = store()
    const stop = app.sub(accelerationMagnitudeSelector, () => {})
    harness.fire(new FakeDeviceMotionEvent({ acceleration }))
    const value = app.get(accelerationMagnitudeSelector)
    stop()
    app.dispose()
    return value
}

describe("accelerationMagnitudeSelector", () => {
    test("returns null when there is no reading", () => {
        harness = installMotion()
        const app = store()
        expect(app.get(accelerationMagnitudeSelector)).toBeNull()
        app.dispose()
    })

    test("returns null when acceleration is null", () => {
        expect(magnitudeAfter(null)).toBeNull()
    })

    test("computes magnitude for a populated vector", () => {
        expect(magnitudeAfter({ x: 3, y: 4, z: 0 })).toBe(5)
    })

    test("treats null components as zero", () => {
        expect(magnitudeAfter({ x: null, y: null, z: 9 })).toBe(9)
    })

    test("returns 0 when all components are null", () => {
        expect(magnitudeAfter({ x: null, y: null, z: null })).toBe(0)
    })
})
