import type { OrientationSnapshot } from "./OrientationSnapshot"
import type { OrientationStatus } from "./OrientationStatus"

/** One coherent publication: the status and the reading change together. */
export interface OrientationState {
    readonly status: OrientationStatus
    readonly orientation: OrientationSnapshot | null
}
