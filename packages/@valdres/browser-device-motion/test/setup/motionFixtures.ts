import { forgetMotionPermission } from "../../src/lib/motionPermission"
import { installDeviceHarness, type DeviceHarness } from "./deviceHarness"

/** A `DeviceMotionEvent` stand-in carrying the fields the package reads. */
export class FakeDeviceMotionEvent extends Event {
    acceleration: DeviceMotionEventAcceleration | null
    accelerationIncludingGravity: DeviceMotionEventAcceleration | null
    rotationRate: DeviceMotionEventRotationRate | null
    interval: number
    constructor(
        init: {
            acceleration?: DeviceMotionEventAcceleration | null
            accelerationIncludingGravity?: DeviceMotionEventAcceleration | null
            rotationRate?: DeviceMotionEventRotationRate | null
            interval?: number
        } = {},
    ) {
        super("devicemotion")
        this.acceleration = init.acceleration ?? null
        this.accelerationIncludingGravity =
            init.accelerationIncludingGravity ?? null
        this.rotationRate = init.rotationRate ?? null
        this.interval = init.interval ?? 16
    }
}

export const motionEvent = (x: number) =>
    new FakeDeviceMotionEvent({
        acceleration: { x, y: 0, z: 0 },
        accelerationIncludingGravity: { x, y: 0, z: 9.8 },
        rotationRate: { alpha: 1, beta: 2, gamma: 3 },
    })

/**
 * Installs the harness with a `DeviceMotionEvent` constructor. `request`, when
 * given, becomes its static `requestPermission`.
 */
export const installMotion = (
    request?: (absolute?: boolean) => Promise<PermissionState>,
): DeviceHarness => {
    const harness = installDeviceHarness()
    forgetMotionPermission(window)
    const ctor = class extends FakeDeviceMotionEvent {}
    if (request !== undefined)
        Object.defineProperty(ctor, "requestPermission", { value: request })
    harness.setGlobal("DeviceMotionEvent", ctor)
    harness.removePermissions()
    const restore = harness.restore
    return {
        ...harness,
        restore: () => {
            forgetMotionPermission(window)
            restore()
        },
    }
}
