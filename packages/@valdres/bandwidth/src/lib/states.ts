import type { BandwidthError } from "../types/BandwidthError"
import type { BandwidthProgress } from "../types/BandwidthProgress"
import type { BandwidthResult } from "../types/BandwidthResult"
import type { BandwidthState } from "../types/BandwidthState"
import type { MeasurementPhase } from "../types/MeasurementPhase"

const fixed = (status: BandwidthState["status"]): BandwidthState =>
    Object.freeze({
        status,
        phase: null,
        progress: null,
        result: null,
        error: null,
    })

export const UNSUPPORTED_STATE = fixed("unsupported")
export const IDLE_STATE = fixed("idle")

/** Running keeps the last result; the previous error is over. */
export const pendingFrom = (
    settled: BandwidthState,
    phase: MeasurementPhase,
    progress: BandwidthProgress,
): BandwidthState =>
    Object.freeze({
        status: "pending",
        phase,
        progress,
        result: settled.result,
        error: null,
    })

export const readyState = (result: BandwidthResult): BandwidthState =>
    Object.freeze({
        status: "ready",
        phase: null,
        progress: null,
        result,
        error: null,
    })

const describe = (error: unknown): BandwidthError =>
    Object.freeze({
        name: String((error as { name?: unknown } | null)?.name ?? "Error"),
        message: String(
            (error as { message?: unknown } | null)?.message ?? error,
        ),
    })

/** A failed measurement keeps the last result next to the new error. */
export const errorFrom = (
    settled: BandwidthState,
    error: unknown,
): BandwidthState =>
    Object.freeze({
        status: "error",
        phase: null,
        progress: null,
        result: settled.result,
        error: describe(error),
    })
