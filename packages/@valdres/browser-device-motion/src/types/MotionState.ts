import type { MotionSnapshot } from "./MotionSnapshot"
import type { MotionStatus } from "./MotionStatus"

/** One coherent publication: the status and the reading change together. */
export interface MotionState {
    readonly status: MotionStatus
    readonly motion: MotionSnapshot | null
}
