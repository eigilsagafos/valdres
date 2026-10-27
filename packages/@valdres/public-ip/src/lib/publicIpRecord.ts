import type { CancelSignal } from "../types/CancelSignal"
import type { PublicIpFamily } from "../types/PublicIpFamily"
import type { PublicIpRequestOptions } from "../types/PublicIpRequestOptions"
import type { PublicIpState } from "../types/PublicIpState"
import { abortError, notSupportedError } from "./domErrors"
import { lookupPublicIp } from "./lookupPublicIp"
import { normalizeOptions } from "./normalizeOptions"
import { notifyAll } from "./notifyAll"
import {
    errorFrom,
    IDLE_STATE,
    pendingFrom,
    readyState,
    UNSUPPORTED_STATE,
} from "./states"

/** One in-flight request, shared by every caller that joined it. */
interface Run {
    readonly controller: AbortController
    done: Promise<string>
    /** A caller without a signal can never cancel, so it keeps the run alive. */
    pinned: boolean
    /** Callers with a signal that are still waiting. */
    waiting: number
}

/**
 * Everything known about one address family. The address is a fact about the
 * network this realm (page, worker or process) sits on, so it is shared by
 * every Store, like the legacy global atoms were; Stores only decide how long
 * they observe it.
 */
interface PublicIpRecord {
    /** What every Store reads. */
    state: PublicIpState
    /** The last state that is not "pending": restored when a run is cancelled. */
    settled: PublicIpState
    /** The run that owns publication. Any other run's outcome is ignored. */
    run: Run | undefined
    readonly registrations: Set<() => void>
}

const LABEL = "Public IP state notification failed"

const create = (): PublicIpRecord => ({
    state: IDLE_STATE,
    settled: IDLE_STATE,
    run: undefined,
    registrations: new Set(),
})

const records: Record<PublicIpFamily, PublicIpRecord> = {
    any: create(),
    v4: create(),
    v6: create(),
}

const isSupported = () => typeof fetch === "function"

const publish = (record: PublicIpRecord, next: PublicIpState): void => {
    if (record.state === next) return
    record.state = next
    notifyAll(record.registrations, LABEL)
}

const settle = (record: PublicIpRecord, next: PublicIpState): void => {
    record.settled = next
    publish(record, next)
}

/** Synchronous; never requests anything. */
export const readPublicIp = (family: PublicIpFamily): PublicIpState =>
    isSupported() ? records[family].state : UNSUPPORTED_STATE

/** Registers one store tree for `family`'s publications. Attaches nothing. */
export const retainPublicIp = (
    family: PublicIpFamily,
    invalidate: () => void,
): (() => void) => {
    const { registrations } = records[family]
    const registration = () => invalidate()
    registrations.add(registration)
    return () => {
        registrations.delete(registration)
    }
}

const start = (
    record: PublicIpRecord,
    options: ReturnType<typeof normalizeOptions>,
): Run => {
    const run: Run = {
        controller: new AbortController(),
        done: undefined as unknown as Promise<string>,
        pinned: false,
        waiting: 0,
    }
    record.run = run
    // The first fetch starts synchronously, inside the caller's task.
    run.done = lookupPublicIp(options, run.controller.signal).then(
        ip => {
            if (record.run === run) {
                record.run = undefined
                settle(record, readyState(ip, Date.now()))
            }
            return ip
        },
        error => {
            if (record.run === run) {
                record.run = undefined
                settle(record, errorFrom(record.settled, error))
            }
            throw error
        },
    )
    // Every caller may have cancelled by the time it settles.
    run.done.catch(() => {})
    if (record.state.status !== "pending")
        publish(record, pendingFrom(record.settled))
    return run
}

/** This caller's view of `run`: settles with it, or with its own signal. */
const join = (
    record: PublicIpRecord,
    run: Run,
    signal: CancelSignal | undefined,
): Promise<string> => {
    if (signal === undefined) {
        run.pinned = true
        return run.done
    }
    run.waiting++
    return new Promise<string>((resolve, reject) => {
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
            // Nobody is left waiting: stop the network work and go back to
            // what was known before, as if this request had never started.
            record.run = undefined
            run.controller.abort(signal.reason)
            publish(record, record.settled)
        }
        signal.addEventListener("abort", cancel, { once: true })
        run.done.then(
            ip => {
                if (leave()) resolve(ip)
            },
            error => {
                if (leave()) reject(error)
            },
        )
    })
}

/**
 * Starts (or joins) a request for one family. See `requestPublicIp` for the
 * contract.
 */
export const requestPublicIpOnce = (
    options?: PublicIpRequestOptions,
): Promise<string> => {
    const normalized = normalizeOptions(options)
    const { signal } = normalized
    if (!isSupported())
        return Promise.reject(notSupportedError("This runtime has no fetch"))
    if (signal?.aborted) return Promise.reject(signal.reason)
    const record = records[normalized.family]
    let run = record.run
    if (run === undefined || normalized.fresh) {
        if (run !== undefined) {
            // Ownership moves first, so the replaced run's settlement is
            // ignored even if the abort comes too late to stop its response.
            record.run = undefined
            run.controller.abort(
                abortError("Replaced by a newer public IP request"),
            )
        }
        run = start(record, normalized)
    }
    return join(record, run, signal)
}

/** @internal Tests: what the record holds for `family`. */
export const inspectPublicIp = (family: PublicIpFamily) => {
    const record = records[family]
    return {
        registrations: record.registrations.size,
        inFlight: record.run !== undefined,
    }
}

/** @internal Tests: abort any run and forget every family's state. */
export const forgetPublicIp = (): void => {
    for (const record of Object.values(records)) {
        const run = record.run
        record.run = undefined
        run?.controller.abort(abortError("Forgotten by a test"))
        record.state = IDLE_STATE
        record.settled = IDLE_STATE
    }
}
