import { BandwidthInsufficientDataError } from "../errors/BandwidthInsufficientDataError"
import type { MeasurementPhaseEnd } from "../types/MeasurementPhaseEnd"
import { bytesToMbps } from "./bytesToMbps"

/**
 * A phase's byte budget, shared by its streams. A stream reserves bytes before
 * it asks for them, so the bytes requested never exceed the budget; once the
 * phase stops (limit, time, stability, failure or abort) nothing more can be
 * reserved, so no further transfer is scheduled.
 */
export interface PhaseTransfer {
    /** Up to `wanted` bytes of the budget; 0 once it is spent or the phase stopped. */
    reserve(wanted: number): number
    /** Gives back reserved bytes that were not transferred. */
    release(bytes: number): void
    /** Counts bytes that were transferred. */
    report(bytes: number): void
}

export type PhaseWorker = (
    signal: AbortSignal,
    transfer: PhaseTransfer,
) => Promise<void>

export interface PhaseOutcome {
    readonly mbps: number
    readonly bytes: number
    readonly endedBy: MeasurementPhaseEnd
    /** The measured interval the rate covers, ms. */
    readonly durationMs: number
}

/**
 * The shortest interval a rate is computed over. Browsers coarsen
 * `performance.now()` to as much as 1 ms, so an interval read from two
 * timestamps can be off by up to 1 ms; at 20 ms that is at most 5 %. A phase
 * that carried bytes over a shorter interval has no defensible rate.
 */
export const MIN_MEASURED_MS = 20

export type RunPhaseOptions = {
    worker: PhaseWorker
    phase?: "download" | "upload"
    /** Payload budget: the bytes this phase may reserve. Default unlimited. */
    maxBytes?: number
    maxDurationMs?: number
    minDurationMs?: number
    warmupMs?: number
    sampleIntervalMs?: number
    windowMs?: number
    stabilityWindowSize?: number
    stabilityThreshold?: number
    startStreams?: number
    maxStreams?: number
    rampUpRatio?: number
    smoothingAlpha?: number
    signal?: AbortSignal
    onUpdate?: (mbps: number, bytes: number) => void
}

/**
 * Runs one throughput phase. Ends when the rate is stable (after
 * `minDurationMs`), at `maxDurationMs`, when `maxBytes` have been transferred,
 * or when every stream finished on its own. An external abort ends it quietly;
 * the caller checks its own signal. Rejects with the first stream failure, or
 * with `BandwidthInsufficientDataError` when it carried no bytes or its
 * measured interval is shorter than `MIN_MEASURED_MS`.
 */
export const runPhase = async ({
    worker,
    phase = "download",
    maxBytes = Infinity,
    maxDurationMs = 10_000,
    minDurationMs = 5_000,
    warmupMs = 2_000,
    sampleIntervalMs = 250,
    windowMs = 1_500,
    stabilityWindowSize = 4,
    stabilityThreshold = 0.05,
    startStreams = 2,
    maxStreams = 8,
    rampUpRatio = 1.15,
    smoothingAlpha = 0.2,
    signal,
    onUpdate,
}: RunPhaseOptions): Promise<PhaseOutcome> => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener("abort", abort, { once: true })
    }

    let endedBy: MeasurementPhaseEnd | undefined
    let endedAt = 0
    const end = (reason: MeasurementPhaseEnd) => {
        if (endedBy === undefined) {
            endedBy = reason
            endedAt = performance.now()
        }
        controller.abort()
    }

    let totalBytes = 0
    let lastByteAt = 0
    let reserved = 0
    const transfer: PhaseTransfer = {
        reserve: wanted => {
            if (controller.signal.aborted) return 0
            const granted = Math.max(0, Math.min(wanted, maxBytes - reserved))
            reserved += granted
            return granted
        },
        release: bytes => {
            reserved -= Math.max(0, bytes)
        },
        report: bytes => {
            totalBytes += bytes
            lastByteAt = performance.now()
            // Stop reading once the budget is counted, even if a server sends
            // more than was asked for (what already arrived is not bounded).
            if (totalBytes >= maxBytes) end("bytes")
        },
    }

    const running: Promise<void>[] = []
    let workerError: unknown = null
    let activeWorkers = 0
    const spawn = () => {
        activeWorkers++
        running.push(
            worker(controller.signal, transfer)
                .catch(err => {
                    if (controller.signal.aborted) return
                    if (workerError === null) workerError = err
                    // First non-abort failure cancels the phase so we surface
                    // it instead of returning a misleading rate.
                    controller.abort()
                })
                .finally(() => {
                    activeWorkers--
                    // Every stream finished without being stopped (the budget
                    // is spent, or the runtime cannot stream): nothing is left
                    // to measure, so end now instead of sleeping out the clock.
                    if (activeWorkers === 0 && !controller.signal.aborted)
                        end(totalBytes >= maxBytes ? "bytes" : "drained")
                }),
        )
    }

    const start = performance.now()
    // The time limit is its own timer, independent of the sampling ticks.
    const timeLimit = setTimeout(() => end("time"), maxDurationMs)
    for (let i = 0; i < startStreams; i++) spawn()

    const samples: { t: number; bytes: number }[] = [{ t: start, bytes: 0 }]
    const rateHistory: number[] = []

    const rateInWindow = (now: number): number => {
        const cutoff = now - windowMs
        let oldest = samples[0]!
        for (let i = samples.length - 1; i >= 0; i--) {
            if (samples[i]!.t <= cutoff) {
                oldest = samples[i]!
                break
            }
            oldest = samples[i]!
        }
        const dt = (now - oldest.t) / 1000
        return dt > 0 ? bytesToMbps(totalBytes - oldest.bytes, dt) : 0
    }

    // Stable = coefficient of variation (stddev / mean) below the threshold
    // over the last N samples. Low CoV means the rate has plateaued, so we
    // have a reliable reading and can stop the phase early.
    const isStable = (): boolean => {
        if (rateHistory.length < stabilityWindowSize) return false
        const recent = rateHistory.slice(-stabilityWindowSize)
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length
        if (mean <= 0) return false
        const variance =
            recent.reduce((s, r) => s + (r - mean) ** 2, 0) / recent.length
        return Math.sqrt(variance) / mean < stabilityThreshold
    }

    const sleep = (ms: number): Promise<void> =>
        new Promise(resolve => {
            let timer: ReturnType<typeof setTimeout>
            const onAbort = () => {
                clearTimeout(timer)
                resolve()
            }
            timer = setTimeout(() => {
                controller.signal.removeEventListener("abort", onAbort)
                resolve()
            }, ms)
            controller.signal.addEventListener("abort", onAbort, { once: true })
        })

    let smoothed = 0
    let sampled = 0
    try {
        while (!controller.signal.aborted) {
            await sleep(sampleIntervalMs)
            if (controller.signal.aborted) break
            const now = performance.now()
            const elapsed = now - start
            samples.push({ t: now, bytes: totalBytes })
            sampled++

            const currentRate = rateInWindow(now)
            smoothed =
                smoothed === 0
                    ? currentRate
                    : smoothingAlpha * currentRate +
                      (1 - smoothingAlpha) * smoothed
            onUpdate?.(smoothed, totalBytes)

            // Stability uses the raw window rate — smoothed values would
            // always look stable because the filter itself suppresses change.
            if (elapsed >= warmupMs) rateHistory.push(currentRate)

            // Ramp-up: if the last sample beat the prior by >= rampUpRatio,
            // we're not saturating the link yet — spawn another stream to
            // push harder. Once samples plateau, isStable() ends the phase.
            if (
                elapsed >= minDurationMs &&
                running.length < maxStreams &&
                rateHistory.length >= 2
            ) {
                const last = rateHistory[rateHistory.length - 1]!
                const prev = rateHistory[rateHistory.length - 2]!
                if (prev > 0 && last > prev * rampUpRatio) spawn()
            }

            if (elapsed >= minDurationMs && isStable()) end("stable")
            else if (elapsed >= maxDurationMs) end("time")
        }
    } finally {
        clearTimeout(timeLimit)
        controller.abort()
        signal?.removeEventListener("abort", abort)
        await Promise.allSettled(running)
    }

    // Surface the first non-abort worker failure rather than returning a
    // misleading rate built from incomplete samples.
    if (workerError !== null) throw workerError
    // Cut short from outside: no reading. The caller rejects with its reason.
    if (endedBy === undefined)
        return { mbps: 0, bytes: totalBytes, endedBy: "time", durationMs: 0 }

    // The result comes from byte counts and timestamps, never from whether a
    // progress tick happened to fire: a phase may end before the first one.
    // A byte-limited or drained phase is timed to its last counted byte; a
    // stable or timed one to the moment it ended.
    const durationMs =
        (endedBy === "bytes" || endedBy === "drained" ? lastByteAt : endedAt) -
        start
    if (totalBytes === 0)
        throw new BandwidthInsufficientDataError(
            phase,
            "no-data",
            totalBytes,
            durationMs,
        )
    if (!(durationMs >= MIN_MEASURED_MS))
        throw new BandwidthInsufficientDataError(
            phase,
            "interval-too-short",
            totalBytes,
            durationMs,
        )
    // Stable and timed phases that were sampled report the smoothed rate the
    // live readout showed. Every other phase reports bytes over its measured
    // interval — which includes request start-up and first-byte latency, so a
    // short one may not represent sustained throughput.
    const mbps =
        (endedBy === "stable" || endedBy === "time") && sampled > 0
            ? smoothed
            : bytesToMbps(totalBytes, durationMs / 1000)
    return { mbps, bytes: totalBytes, endedBy, durationMs }
}
