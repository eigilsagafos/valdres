/**
 * Compile-time contracts: the state is read-only, results carry their units
 * as plain numbers, and the measurement returns a promise of a plain result.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes any export writable or loosens a signature.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    bandwidthAtom,
    downloadSpeedAtom,
    jitterAtom,
    lastMeasurementAtom,
    latencyAtom,
    measureBandwidth,
    measurementStatusAtom,
    uploadSpeedAtom,
    type BandwidthError,
    type BandwidthProgress,
    type BandwidthResult,
    type BandwidthState,
    type MeasureBandwidthOptions,
    type MeasurementPhase,
    type MeasurementStatus,
} from "../src/index"

const rejectedWrites = (
    app: Store,
    state: BandwidthState,
    result: BandwidthResult,
) => {
    // @ts-expect-error an external atom cannot be written
    app.set(bandwidthAtom, app.get(bandwidthAtom))
    // @ts-expect-error a selector cannot be written
    app.set(downloadSpeedAtom, 100)
    // @ts-expect-error an external atom cannot be reset
    app.reset(bandwidthAtom)
    // @ts-expect-error snapshots are read-only
    state.status = "ready"
    // @ts-expect-error results are read-only
    result.downloadMbps = 1
    // @ts-expect-error measurements are not tied to a Store
    void measureBandwidth(app)
    // @ts-expect-error the retired invalidation option is gone
    void measureBandwidth({ invalidateOn: [] })
}

test("reads keep their declared value domains", () => {
    const app = store()
    const state: ExternalAtom<BandwidthState> = bandwidthAtom
    const numbers: Selector<number | null>[] = [
        downloadSpeedAtom,
        uploadSpeedAtom,
        latencyAtom,
        jitterAtom,
        lastMeasurementAtom,
    ]
    const status: Selector<MeasurementStatus> = measurementStatusAtom
    const phase: MeasurementPhase | null = app.get(state).phase
    const progress: BandwidthProgress | null = app.get(state).progress
    const error: BandwidthError | null = app.get(state).error
    const options: MeasureBandwidthOptions = {
        latencySamples: 3,
        maxDurationMs: 1,
        minDurationMs: 0,
        warmupMs: 0,
        startStreams: 1,
        maxStreams: 1,
        stabilityThreshold: 0.1,
        fresh: true,
        signal: new AbortController().signal,
    }
    const measure: (
        options?: MeasureBandwidthOptions,
    ) => Promise<BandwidthResult> = measureBandwidth
    expect(app.get(state).status).toBe(app.get(status))
    expect([
        phase,
        progress,
        error,
        ...numbers.map(selector => app.get(selector)),
    ]).toEqual([null, null, null, null, null, null, null, null])
    expect([typeof measure, typeof rejectedWrites, options.fresh]).toEqual([
        "function",
        "function",
        true,
    ])
    app.dispose()
})
