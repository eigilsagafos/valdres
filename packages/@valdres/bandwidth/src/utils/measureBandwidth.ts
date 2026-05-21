import { measurementCache } from "../lib/measurementCache"
import { startCachedMeasurement } from "../lib/startCachedMeasurement"
import type { BandwidthResult } from "../types/BandwidthResult"
import type { MeasureBandwidthOptions } from "../types/MeasureBandwidthOptions"

export const measureBandwidth = (
    options: MeasureBandwidthOptions = {},
): Promise<BandwidthResult> => {
    // When a measurement is already in-flight, options are ignored — callers
    // join the existing run. Use `fresh: true` to force a new run with new options.
    if (!options.fresh && measurementCache.promise) {
        return measurementCache.promise
    }
    const { signal: externalSignal, fresh: _fresh, ...rest } = options
    const controller = new AbortController()
    const forwardAbort = () => controller.abort()
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort()
        else
            externalSignal.addEventListener("abort", forwardAbort, {
                once: true,
            })
    }
    measurementCache.promise = startCachedMeasurement(
        rest,
        controller,
    ).finally(() => {
        externalSignal?.removeEventListener("abort", forwardAbort)
    })
    return measurementCache.promise
}
