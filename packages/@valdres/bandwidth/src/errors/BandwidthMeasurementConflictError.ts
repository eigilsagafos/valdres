import type { BandwidthMeasurementConfig } from "../types/BandwidthMeasurementConfig"

/**
 * The rejection of a `measureBandwidth` call made while a measurement with a
 * different effective configuration is running. There is one measurement at a
 * time per page or process, and calls share it only when their configurations
 * match; a conflicting call never silently receives another configuration's
 * result, and the running measurement and its state are left alone. Wait for
 * it, cancel it, or pass `fresh: true` to replace it.
 */
export class BandwidthMeasurementConflictError extends Error {
    readonly code = "VALDRES_BANDWIDTH_MEASUREMENT_CONFLICT"
    readonly active: BandwidthMeasurementConfig
    readonly requested: BandwidthMeasurementConfig
    constructor(
        active: BandwidthMeasurementConfig,
        requested: BandwidthMeasurementConfig,
    ) {
        super(
            `A bandwidth measurement is already running with ${JSON.stringify(active)}; ` +
                `it cannot be shared by a measurement with ${JSON.stringify(requested)}. ` +
                "Wait for it, cancel it, or pass fresh: true to replace it.",
        )
        this.name = "BandwidthMeasurementConflictError"
        this.active = active
        this.requested = requested
    }
}
