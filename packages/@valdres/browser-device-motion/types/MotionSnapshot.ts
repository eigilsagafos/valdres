export type Vector3 = {
    x: number | null
    y: number | null
    z: number | null
}

export type RotationRateSnapshot = {
    alpha: number | null
    beta: number | null
    gamma: number | null
}

export type MotionSnapshot = {
    acceleration: Vector3 | null
    accelerationIncludingGravity: Vector3 | null
    rotationRate: RotationRateSnapshot | null
    interval: number
    timestamp: number
}
