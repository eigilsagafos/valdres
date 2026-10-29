/**
 * Test doubles that keep every byte inside the process: a scripted
 * measurement runner (each run stays pending until the test settles it) and
 * report capture. Nothing here contacts a measurement server.
 */
import type { BandwidthProgress } from "../../src/types/BandwidthProgress"
import type { BandwidthResult } from "../../src/types/BandwidthResult"
import type { MeasurementPhase } from "../../src/types/MeasurementPhase"
import type { BandwidthMeasurementConfig } from "../../src/types/BandwidthMeasurementConfig"

export interface ScriptedRun {
    readonly options: BandwidthMeasurementConfig
    readonly signal: AbortSignal
    /** Reports a phase and provisional readings, as the real runner does. */
    report(phase: MeasurementPhase, progress: Partial<BandwidthProgress>): void
    complete(result?: Partial<BandwidthResult>): BandwidthResult
    fail(error?: unknown): void
}

export interface ScriptedRunner {
    readonly runs: ScriptedRun[]
    /**
     * When true, an abort does NOT reject the run: models readings that were
     * already in flight when the abort arrived.
     */
    ignoreAbort: boolean
    readonly runner: (
        options: BandwidthMeasurementConfig,
        signal: AbortSignal,
        report: (phase: MeasurementPhase, progress: BandwidthProgress) => void,
    ) => Promise<BandwidthResult>
}

const EMPTY: BandwidthProgress = Object.freeze({
    latencyMs: null,
    jitterMs: null,
    downloadMbps: null,
    uploadMbps: null,
    downloadBytes: null,
    uploadBytes: null,
})

export const scriptedRunner = (): ScriptedRunner => {
    const scripted: ScriptedRunner = {
        runs: [],
        ignoreAbort: false,
        runner: (options, signal, report) =>
            new Promise<BandwidthResult>((resolve, reject) => {
                let progress = EMPTY
                scripted.runs.push({
                    options,
                    signal,
                    report: (phase, next) => {
                        progress = Object.freeze({ ...progress, ...next })
                        report(phase, progress)
                    },
                    complete: result => {
                        const done = Object.freeze({
                            downloadMbps: 100,
                            uploadMbps: 20,
                            latencyMs: 12,
                            jitterMs: 1.5,
                            downloadBytes: 25_000_000,
                            uploadBytes: 10_000_000,
                            downloadEndedBy: "bytes",
                            uploadEndedBy: "bytes",
                            downloadDurationMs: 1_900,
                            uploadDurationMs: 3_600,
                            timestamp: Date.now(),
                            ...result,
                        })
                        resolve(done)
                        return done
                    },
                    fail: (
                        error = new Error(
                            "download failed: 503 Service Unavailable",
                        ),
                    ) => reject(error),
                })
                signal.addEventListener("abort", () => {
                    if (!scripted.ignoreAbort) reject(signal.reason)
                })
                report("latency", progress)
            }),
    }
    return scripted
}

/** Lets queued promise reactions and zero-delay timers run. */
export const flush = async (rounds = 3): Promise<void> => {
    for (let round = 0; round < rounds; round++)
        await new Promise(resolve => setTimeout(resolve, 0))
}

export interface ReportCapture {
    readonly reported: unknown[]
    readonly unhandled: unknown[]
    restore(): void
}

/** Captures `reportError` calls and unhandled rejections. */
export const captureReports = (): ReportCapture => {
    const reported: unknown[] = []
    const unhandled: unknown[] = []
    const own = Object.getOwnPropertyDescriptor(globalThis, "reportError")
    Object.defineProperty(globalThis, "reportError", {
        configurable: true,
        writable: true,
        value: (error: unknown) => {
            reported.push(error)
        },
    })
    const onUnhandled = (reason: unknown) => {
        unhandled.push(reason)
    }
    process.on("unhandledRejection", onUnhandled)
    return {
        reported,
        unhandled,
        restore: () => {
            process.off("unhandledRejection", onUnhandled)
            if (own === undefined)
                delete (globalThis as { reportError?: unknown }).reportError
            else Object.defineProperty(globalThis, "reportError", own)
        },
    }
}
