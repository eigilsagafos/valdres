import type {
    MotionSnapshot,
    RotationRateSnapshot,
    Vector3,
} from "../../types/MotionSnapshot"

const toVector3 = (
    acc: DeviceMotionEventAcceleration | null,
): Vector3 | null => {
    if (!acc) return null
    return { x: acc.x, y: acc.y, z: acc.z }
}

const toRotationRate = (
    rate: DeviceMotionEventRotationRate | null,
): RotationRateSnapshot | null => {
    if (!rate) return null
    return { alpha: rate.alpha, beta: rate.beta, gamma: rate.gamma }
}

export const toSnapshot = (event: DeviceMotionEvent): MotionSnapshot => ({
    acceleration: toVector3(event.acceleration),
    accelerationIncludingGravity: toVector3(event.accelerationIncludingGravity),
    rotationRate: toRotationRate(event.rotationRate),
    interval: event.interval,
    timestamp: event.timeStamp,
})
