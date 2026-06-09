import { measurementCache } from "../lib/measurementCache"
import { ensureMeasurement } from "../lib/ensureMeasurement"

export const invalidateMeasurement = (): void => {
    const hadCache = measurementCache.promise !== null
    measurementCache.controller?.abort()
    measurementCache.promise = null
    measurementCache.controller = null
    if (hadCache) {
        // A measurement was in-flight or completed — start a fresh one so
        // subscribed atoms receive updated values without a manual re-read.
        void ensureMeasurement().catch(() => {})
    }
}
