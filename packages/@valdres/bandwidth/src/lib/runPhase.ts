import { bytesToMbps } from "./bytesToMbps"

export type PhaseWorker = (
    signal: AbortSignal,
    reportBytes: (bytes: number) => void,
) => Promise<void>

export type RunPhaseOptions = {
    worker: PhaseWorker
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
    onUpdate?: (mbps: number) => void
}

export const runPhase = async ({
    worker,
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
}: RunPhaseOptions): Promise<number> => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener("abort", abort, { once: true })
    }

    let totalBytes = 0
    const reportBytes = (bytes: number) => {
        totalBytes += bytes
    }

    const running: Promise<void>[] = []
    let workerError: unknown = null
    const spawn = () => {
        running.push(
            worker(controller.signal, reportBytes).catch(err => {
                if (controller.signal.aborted) return
                if (workerError === null) workerError = err
                // First non-abort failure cancels the phase so we surface
                // it instead of returning a misleading rate.
                controller.abort()
            }),
        )
    }
    for (let i = 0; i < startStreams; i++) spawn()

    const start = performance.now()
    const samples: { t: number; bytes: number }[] = [{ t: start, bytes: 0 }]
    const rateHistory: number[] = []

    const rateInWindow = (now: number): number => {
        const cutoff = now - windowMs
        let oldest = samples[0]
        for (let i = samples.length - 1; i >= 0; i--) {
            if (samples[i].t <= cutoff) {
                oldest = samples[i]
                break
            }
            oldest = samples[i]
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
    try {
        while (!controller.signal.aborted) {
            await sleep(sampleIntervalMs)
            const now = performance.now()
            const elapsed = now - start
            samples.push({ t: now, bytes: totalBytes })

            const currentRate = rateInWindow(now)
            smoothed =
                smoothed === 0
                    ? currentRate
                    : smoothingAlpha * currentRate +
                      (1 - smoothingAlpha) * smoothed
            onUpdate?.(smoothed)

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
                const last = rateHistory[rateHistory.length - 1]
                const prev = rateHistory[rateHistory.length - 2]
                if (prev > 0 && last > prev * rampUpRatio) spawn()
            }

            if (elapsed >= minDurationMs && isStable()) break
            if (elapsed >= maxDurationMs) break
        }
    } finally {
        controller.abort()
        signal?.removeEventListener("abort", abort)
        await Promise.allSettled(running)
    }

    // Surface the first non-abort worker failure rather than returning a
    // misleading rate built from incomplete samples.
    if (workerError !== null) throw workerError

    // Return the last displayed value so there's no jump between the live
    // readout and the final number.
    return smoothed
}
