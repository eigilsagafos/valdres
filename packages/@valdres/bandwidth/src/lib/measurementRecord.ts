import type { BandwidthResult } from "../types/BandwidthResult"
import type { CancelSignal } from "../types/CancelSignal"
import type { BandwidthState } from "../types/BandwidthState"
import type { MeasureBandwidthOptions } from "../types/MeasureBandwidthOptions"
import { abortError, notSupportedError } from "./domErrors"
import { normalizeOptions, type NormalizedOptions } from "./normalizeOptions"
import { notifyAll } from "./notifyAll"
import { runMeasurement, type ReportProgress } from "./runMeasurement"
import {
    errorFrom,
    IDLE_STATE,
    pendingFrom,
    readyState,
    UNSUPPORTED_STATE,
} from "./states"

type Runner = (
    options: NormalizedOptions,
    signal: AbortSignal,
    report: ReportProgress,
) => Promise<BandwidthResult>

/** One running measurement, shared by every caller that joined it. */
interface Run {
    readonly controller: AbortController
    done: Promise<BandwidthResult>
    /** A caller without a signal can never cancel, so it keeps the run alive. */
    pinned: boolean
    /** Callers with a signal that are still waiting. */
    waiting: number
}

/**
 * The realm's (page, worker or process) one measurement record, shared by
 * every Store. Two measurements running at once would compete for the same
 * link and corrupt each other's readings, so there is only ever one.
 */
const record: {
    /** What every Store reads. */
    state: BandwidthState
    /** The last state that is not "pending": restored when a run is cancelled. */
    settled: BandwidthState
    /** The run that owns publication. Any other run's progress or outcome is ignored. */
    run: Run | undefined
    readonly registrations: Set<() => void>
} = {
    state: IDLE_STATE,
    settled: IDLE_STATE,
    run: undefined,
    registrations: new Set(),
}

let runner: Runner = runMeasurement

const LABEL = "Bandwidth state notification failed"

const isSupported = () =>
    typeof fetch === "function" &&
    typeof performance === "object" &&
    typeof performance?.now === "function"

const publish = (next: BandwidthState): void => {
    if (record.state === next) return
    record.state = next
    notifyAll(record.registrations, LABEL)
}

const settle = (next: BandwidthState): void => {
    record.settled = next
    publish(next)
}

/** Synchronous; never measures anything. */
export const readBandwidth = (): BandwidthState =>
    isSupported() ? record.state : UNSUPPORTED_STATE

/** Registers one store tree for publications. Attaches nothing. */
export const retainBandwidth = (invalidate: () => void): (() => void) => {
    const registration = () => invalidate()
    record.registrations.add(registration)
    return () => {
        record.registrations.delete(registration)
    }
}

const start = (options: NormalizedOptions): Run => {
    const run: Run = {
        controller: new AbortController(),
        done: undefined as unknown as Promise<BandwidthResult>,
        pinned: false,
        waiting: 0,
    }
    record.run = run
    // The first request starts synchronously, inside the caller's task, and
    // reports "pending" before the runner returns. That first publication is
    // held until `run.done` exists, so a subscriber that measures again while
    // it is delivered joins a complete run.
    let starting = true
    let first: BandwidthState | undefined
    run.done = runner(options, run.controller.signal, (phase, progress) => {
        if (record.run !== run) return
        const next = pendingFrom(record.settled, phase, progress)
        if (starting) first = next
        else publish(next)
    }).then(
        result => {
            if (record.run === run) {
                record.run = undefined
                settle(readyState(result))
            }
            return result
        },
        error => {
            if (record.run === run) {
                record.run = undefined
                settle(errorFrom(record.settled, error))
            }
            throw error
        },
    )
    // Every caller may have cancelled by the time it settles.
    run.done.catch(() => {})
    starting = false
    if (first !== undefined && record.run === run) publish(first)
    return run
}

/** This caller's view of `run`: settles with it, or with its own signal. */
const join = (
    run: Run,
    signal: CancelSignal | undefined,
): Promise<BandwidthResult> => {
    if (signal === undefined) {
        run.pinned = true
        return run.done
    }
    run.waiting++
    return new Promise<BandwidthResult>((resolve, reject) => {
        let waiting = true
        const leave = () => {
            if (!waiting) return false
            waiting = false
            signal.removeEventListener("abort", cancel)
            return true
        }
        const cancel = () => {
            if (!leave()) return
            reject(signal.reason)
            run.waiting--
            if (run.pinned || run.waiting > 0 || record.run !== run) return
            // Nobody is left waiting: stop transferring and go back to what
            // was known before, as if this measurement had never started.
            record.run = undefined
            run.controller.abort(signal.reason)
            publish(record.settled)
        }
        signal.addEventListener("abort", cancel, { once: true })
        run.done.then(
            result => {
                if (leave()) resolve(result)
            },
            error => {
                if (leave()) reject(error)
            },
        )
    })
}

/** Starts (or joins) the measurement. See `measureBandwidth` for the contract. */
export const measureBandwidthOnce = (
    input?: MeasureBandwidthOptions,
): Promise<BandwidthResult> => {
    const { options, signal, fresh } = normalizeOptions(input)
    if (!isSupported())
        return Promise.reject(
            notSupportedError("This runtime has no fetch or performance.now"),
        )
    if (signal?.aborted) return Promise.reject(signal.reason)
    let run = record.run
    if (run === undefined || fresh) {
        if (run !== undefined) {
            // Ownership moves first, so the replaced run's late progress and
            // outcome are ignored even if the abort comes too late to stop them.
            record.run = undefined
            run.controller.abort(
                abortError("Replaced by a newer bandwidth measurement"),
            )
        }
        run = start(options)
    }
    return join(run, signal)
}

/** @internal Tests: what the record holds. */
export const inspectBandwidth = () => ({
    registrations: record.registrations.size,
    running: record.run !== undefined,
})

/** @internal Tests: replace the network measurement, or restore it. */
export const useMeasurementRunner = (next: Runner = runMeasurement): void => {
    runner = next
}

/** @internal Tests: abort any run and forget the state. */
export const forgetBandwidth = (): void => {
    const run = record.run
    record.run = undefined
    run?.controller.abort(abortError("Forgotten by a test"))
    record.state = IDLE_STATE
    record.settled = IDLE_STATE
}
