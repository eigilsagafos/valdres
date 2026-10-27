import type { BandwidthProgress } from "../types/BandwidthProgress"
import type { BandwidthResult } from "../types/BandwidthResult"
import type { MeasurementPhase } from "../types/MeasurementPhase"
import { measureDownload } from "./measureDownload"
import { measureLatency } from "./measureLatency"
import { measureUpload } from "./measureUpload"
import { median } from "./median"
import type { NormalizedOptions } from "./normalizeOptions"
import { stdDev } from "./stdDev"

export type ReportProgress = (
    phase: MeasurementPhase,
    progress: BandwidthProgress,
) => void

/**
 * Runs latency, download and upload in order against the measurement server
 * and resolves the frozen result. Stateless: `report` receives each phase as
 * it starts and every provisional reading. An abort rejects with
 * `signal.reason` at the next step — never a partial result.
 */
export const runMeasurement = async (
    options: NormalizedOptions,
    signal: AbortSignal,
    report: ReportProgress,
): Promise<BandwidthResult> => {
    const { latencySamples, ...phase } = options
    let progress: BandwidthProgress = Object.freeze({
        latencyMs: null,
        jitterMs: null,
        downloadMbps: null,
        uploadMbps: null,
    })
    const update = (
        current: MeasurementPhase,
        next: Partial<BandwidthProgress>,
    ) => {
        progress = Object.freeze({ ...progress, ...next })
        report(current, progress)
    }

    report("latency", progress)
    const latencies = await measureLatency(latencySamples, signal)
    signal.throwIfAborted()
    const latencyMs = median(latencies)
    const jitterMs = stdDev(latencies)

    update("download", { latencyMs, jitterMs })
    const downloadMbps = await measureDownload({
        ...phase,
        signal,
        onUpdate: mbps => update("download", { downloadMbps: mbps }),
    })
    // runPhase ends quietly on abort; a cut-short phase is not a reading.
    signal.throwIfAborted()

    update("upload", { downloadMbps })
    const uploadMbps = await measureUpload({
        ...phase,
        signal,
        onUpdate: mbps => update("upload", { uploadMbps: mbps }),
    })
    signal.throwIfAborted()

    return Object.freeze({
        downloadMbps,
        uploadMbps,
        latencyMs,
        jitterMs,
        timestamp: Date.now(),
    })
}
