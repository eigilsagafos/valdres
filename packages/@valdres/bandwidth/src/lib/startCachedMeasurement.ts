import { measurementCache } from "./measurementCache"
import { runMeasurement } from "./runMeasurement"
import type { BandwidthResult } from "../../types/BandwidthResult"
import type { MeasureBandwidthOptions } from "../../types/MeasureBandwidthOptions"

export const startCachedMeasurement = (
    options: Omit<MeasureBandwidthOptions, "fresh" | "signal">,
    controller: AbortController,
): Promise<BandwidthResult> => {
    measurementCache.controller = controller
    return runMeasurement({ ...options, signal: controller.signal }).catch(
        err => {
            if (measurementCache.controller === controller) {
                measurementCache.promise = null
                measurementCache.controller = null
            }
            throw err
        },
    )
}
