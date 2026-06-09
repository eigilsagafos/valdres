import {
    __invalidationState,
    setupInvalidation,
} from "../../src/lib/setupInvalidation"
import { measurementCache } from "../../src/lib/measurementCache"
import { invalidateOnAtom } from "../../src/atoms/invalidateOnAtom"
import { measurementStatusAtom } from "../../src/atoms/measurementStatusAtom"
import { downloadSpeedAtom } from "../../src/atoms/downloadSpeedAtom"
import { uploadSpeedAtom } from "../../src/atoms/uploadSpeedAtom"
import { latencyAtom } from "../../src/atoms/latencyAtom"
import { jitterAtom } from "../../src/atoms/jitterAtom"
import { lastMeasurementAtom } from "../../src/atoms/lastMeasurementAtom"

export const resetGlobals = (): void => {
    // setSelf on atoms with factory defaults triggers the factory and starts
    // a real measurement — reset the atoms first, then clear the cache.
    measurementStatusAtom.setSelf("idle")
    downloadSpeedAtom.setSelf(0)
    uploadSpeedAtom.setSelf(0)
    latencyAtom.setSelf(0)
    jitterAtom.setSelf(0)
    lastMeasurementAtom.setSelf(null)
    invalidateOnAtom.setSelf([])

    measurementCache.controller?.abort()
    measurementCache.promise = null
    measurementCache.controller = null

    for (const unsub of __invalidationState.watcherUnsubs) unsub()
    __invalidationState.watcherUnsubs = []
    __invalidationState.rewireUnsub?.()
    __invalidationState.rewireUnsub = null
    __invalidationState.setupDone = false

    // Re-wire for the next test — mirrors the module-load side effect.
    setupInvalidation()
}
