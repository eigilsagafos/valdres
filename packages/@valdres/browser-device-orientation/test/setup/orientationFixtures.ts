import { forgetOrientationPermission } from "../../src/lib/orientationPermission"
import { installDeviceHarness, type DeviceHarness } from "./deviceHarness"

/** A `DeviceOrientationEvent` stand-in carrying the fields the package reads. */
export class FakeDeviceOrientationEvent extends Event {
    alpha: number | null
    beta: number | null
    gamma: number | null
    absolute: boolean
    constructor(
        init: {
            alpha?: number | null
            beta?: number | null
            gamma?: number | null
            absolute?: boolean
            webkitCompassHeading?: number
        } = {},
    ) {
        super("deviceorientation")
        this.alpha = init.alpha ?? null
        this.beta = init.beta ?? null
        this.gamma = init.gamma ?? null
        this.absolute = init.absolute ?? false
        if (init.webkitCompassHeading !== undefined)
            Object.assign(this, { webkitCompassHeading: init.webkitCompassHeading })
    }
}

export const orientationEvent = (alpha: number) =>
    new FakeDeviceOrientationEvent({ alpha, beta: 10, gamma: -5 })

/**
 * Installs the harness with a `DeviceOrientationEvent` constructor. `request`,
 * when given, becomes its static `requestPermission`.
 */
export const installOrientation = (
    request?: (absolute?: boolean) => Promise<PermissionState>,
): DeviceHarness => {
    const harness = installDeviceHarness()
    forgetOrientationPermission(window)
    const ctor = class extends FakeDeviceOrientationEvent {}
    if (request !== undefined)
        Object.defineProperty(ctor, "requestPermission", { value: request })
    harness.setGlobal("DeviceOrientationEvent", ctor)
    harness.removePermissions()
    const restore = harness.restore
    return {
        ...harness,
        restore: () => {
            forgetOrientationPermission(window)
            restore()
        },
    }
}
