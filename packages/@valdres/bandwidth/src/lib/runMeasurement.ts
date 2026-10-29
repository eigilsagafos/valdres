import type { BandwidthMeasurementConfig } from "../types/BandwidthMeasurementConfig"
import type { BandwidthProgress } from "../types/BandwidthProgress"
import type { BandwidthResult } from "../types/BandwidthResult"
import type { MeasurementPhase } from "../types/MeasurementPhase"
import { measureDownload } from "./measureDownload"
import { measureLatency } from "./measureLatency"
import { measureUpload } from "./measureUpload"
import { median } from "./median"
import { stdDev } from "./stdDev"

export type ReportProgress = (
    phase: MeasurementPhase,
    progress: BandwidthProgress,
) => void

/**
 * Runs latency, download and upload in order against the configured server
 * and resolves the frozen result. Stateless: `report` receives each phase as
 * it starts and every provisional reading. An abort rejects with
 * `signal.reason` at the next step — never a partial result; a phase without
 * a usable reading rejects with `BandwidthInsufficientDataError`.
 */
export const runMeasurement = async (
    config: BandwidthMeasurementConfig,
    signal: AbortSignal,
    report: ReportProgress,
): Promise<BandwidthResult> => {
    const {
        endpoints,
        latencySamples,
        maxDownloadBytes,
        maxUploadBytes,
        ...phase
    } = config
    let progress: BandwidthProgress = Object.freeze({
        latencyMs: null,
        jitterMs: null,
        downloadMbps: null,
        uploadMbps: null,
        downloadBytes: null,
        uploadBytes: null,
    })
    const update = (
        current: MeasurementPhase,
        next: Partial<BandwidthProgress>,
    ) => {
        progress = Object.freeze({ ...progress, ...next })
        report(current, progress)
    }

    report("latency", progress)
    const latencies = await measureLatency(
        endpoints.download,
        latencySamples,
        signal,
    )
    signal.throwIfAborted()
    const latencyMs = median(latencies)
    const jitterMs = stdDev(latencies)

    update("download", { latencyMs, jitterMs, downloadBytes: 0 })
    const download = await measureDownload(endpoints.download, {
        ...phase,
        maxBytes: maxDownloadBytes,
        signal,
        onUpdate: (mbps, bytes) =>
            update("download", { downloadMbps: mbps, downloadBytes: bytes }),
    })
    // runPhase ends quietly on abort; a cut-short phase is not a reading.
    signal.throwIfAborted()

    update("upload", {
        downloadMbps: download.mbps,
        downloadBytes: download.bytes,
        uploadBytes: 0,
    })
    const upload = await measureUpload(endpoints.upload, {
        ...phase,
        maxBytes: maxUploadBytes,
        signal,
        onUpdate: (mbps, bytes) =>
            update("upload", { uploadMbps: mbps, uploadBytes: bytes }),
    })
    signal.throwIfAborted()

    return Object.freeze({
        downloadMbps: download.mbps,
        uploadMbps: upload.mbps,
        latencyMs,
        jitterMs,
        downloadBytes: download.bytes,
        uploadBytes: upload.bytes,
        downloadEndedBy: download.endedBy,
        uploadEndedBy: upload.endedBy,
        downloadDurationMs: download.durationMs,
        uploadDurationMs: upload.durationMs,
        timestamp: Date.now(),
    })
}
