import { downloadSpeedAtom } from "../atoms/downloadSpeedAtom"
import { uploadSpeedAtom } from "../atoms/uploadSpeedAtom"
import { latencyAtom } from "../atoms/latencyAtom"
import { jitterAtom } from "../atoms/jitterAtom"
import { measurementStatusAtom } from "../atoms/measurementStatusAtom"
import { lastMeasurementAtom } from "../atoms/lastMeasurementAtom"
import { measureLatency } from "./measureLatency"
import { measureDownload } from "./measureDownload"
import { measureUpload } from "./measureUpload"
import { median } from "./median"
import { stdDev } from "./stdDev"
import type { BandwidthResult } from "../types/BandwidthResult"
import type { MeasureBandwidthOptions } from "../types/MeasureBandwidthOptions"

export const runMeasurement = async (
    options: MeasureBandwidthOptions = {},
): Promise<BandwidthResult> => {
    const {
        latencySamples = 10,
        maxDurationMs,
        minDurationMs,
        warmupMs,
        startStreams,
        maxStreams,
        stabilityThreshold,
        signal,
    } = options

    const phaseOptions = {
        maxDurationMs,
        minDurationMs,
        warmupMs,
        startStreams,
        maxStreams,
        stabilityThreshold,
        signal,
    }

    try {
        // Pre-aborted signal: bail out before flipping any status atoms so
        // we don't leave consumers stuck on a "measuring-*" state.
        if (signal?.aborted) {
            throw Object.assign(new Error("aborted"), { name: "AbortError" })
        }
        measurementStatusAtom.setSelf("measuring-latency")
        const latencies = await measureLatency(latencySamples, signal)
        const latencyMs = median(latencies)
        const jitterMs = stdDev(latencies)
        latencyAtom.setSelf(latencyMs)
        jitterAtom.setSelf(jitterMs)

        measurementStatusAtom.setSelf("measuring-download")
        const downloadMbps = await measureDownload({
            ...phaseOptions,
            onUpdate: mbps => downloadSpeedAtom.setSelf(mbps),
        })
        downloadSpeedAtom.setSelf(downloadMbps)

        measurementStatusAtom.setSelf("measuring-upload")
        const uploadMbps = await measureUpload({
            ...phaseOptions,
            onUpdate: mbps => uploadSpeedAtom.setSelf(mbps),
        })
        uploadSpeedAtom.setSelf(uploadMbps)

        const timestamp = Date.now()
        lastMeasurementAtom.setSelf(timestamp)
        measurementStatusAtom.setSelf("complete")

        return { downloadMbps, uploadMbps, latencyMs, jitterMs, timestamp }
    } catch (error) {
        // An abort means a caller (e.g. invalidateMeasurement) intentionally
        // cancelled this run — don't flip status to "error", since a fresh
        // measurement is typically already in flight and owns the status.
        if (!signal?.aborted) measurementStatusAtom.setSelf("error")
        throw error
    }
}
