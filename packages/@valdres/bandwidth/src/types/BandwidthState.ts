import type { BandwidthError } from "./BandwidthError"
import type { BandwidthProgress } from "./BandwidthProgress"
import type { BandwidthResult } from "./BandwidthResult"
import type { MeasurementPhase } from "./MeasurementPhase"
import type { MeasurementStatus } from "./MeasurementStatus"

/**
 * One coherent publication. `phase` and `progress` are set only while
 * `"pending"`, `error` only while `"error"`. `result` is the last completed
 * measurement and survives a running or failed one.
 */
export interface BandwidthState {
    readonly status: MeasurementStatus
    readonly phase: MeasurementPhase | null
    readonly progress: BandwidthProgress | null
    readonly result: BandwidthResult | null
    readonly error: BandwidthError | null
}
