import { measurementCache } from "./measurementCache"
import { startCachedMeasurement } from "./startCachedMeasurement"
import type { BandwidthResult } from "../../types/BandwidthResult"

export const ensureMeasurement = (): Promise<BandwidthResult> => {
    if (measurementCache.promise) return measurementCache.promise
    measurementCache.promise = startCachedMeasurement({}, new AbortController())
    return measurementCache.promise
}
