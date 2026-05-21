export { motionAtom } from "./atoms/motionAtom"
export { permissionAtom } from "./atoms/permissionAtom"
export { motionStatusAtom } from "./atoms/motionStatusAtom"
export { accelerationSelector } from "./selectors/accelerationSelector"
export { accelerationIncludingGravitySelector } from "./selectors/accelerationIncludingGravitySelector"
export { accelerationMagnitudeSelector } from "./selectors/accelerationMagnitudeSelector"
export { rotationRateSelector } from "./selectors/rotationRateSelector"
export { intervalSelector } from "./selectors/intervalSelector"
export { requestMotionPermission } from "./lib/requestMotionPermission"

export type {
    MotionSnapshot,
    Vector3,
    RotationRateSnapshot,
} from "./types/MotionSnapshot"
export type { MotionStatus } from "./types/MotionStatus"
export type { PermissionValue } from "./types/PermissionValue"
