import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { atom, store, type Store } from "valdres"
import {
    captureReports,
    flush,
    scriptedRunner,
    type ReportCapture,
    type ScriptedRunner,
} from "../../test/setup/harness"
import { bandwidthAtom } from "../atoms/bandwidthAtom"
import {
    forgetBandwidth,
    inspectBandwidth,
    useMeasurementRunner,
} from "../lib/measurementRecord"
import { downloadSpeedAtom } from "../selectors/downloadSpeedAtom"
import { jitterAtom } from "../selectors/jitterAtom"
import { lastMeasurementAtom } from "../selectors/lastMeasurementAtom"
import { latencyAtom } from "../selectors/latencyAtom"
import { measurementStatusAtom } from "../selectors/measurementStatusAtom"
import { uploadSpeedAtom } from "../selectors/uploadSpeedAtom"
import { measureBandwidth } from "./measureBandwidth"

let net: ScriptedRunner
let reports: ReportCapture
const stores: Store[] = []
const app = () => {
    const created = store()
    stores.push(created)
    return created
}

beforeEach(() => {
    net = scriptedRunner()
    useMeasurementRunner(net.runner)
    reports = captureReports()
})
afterEach(async () => {
    for (const created of stores.splice(0)) created.dispose()
    forgetBandwidth()
    useMeasurementRunner()
    await flush()
    reports.restore()
})

/** Every `status/phase` a store's subscriber saw, in order. */
const watch = (target: Store) => {
    const seen: string[] = []
    const stop = target.sub(bandwidthAtom, () => {
        const { status, phase } = target.get(bandwidthAtom)
        seen.push(phase === null ? status : `${status}/${phase}`)
    })
    return { seen, stop }
}

describe("explicit measurement", () => {
    test("reading and subscribing measure nothing", () => {
        const root = app()
        expect(root.get(bandwidthAtom)).toEqual({
            status: "idle",
            phase: null,
            progress: null,
            result: null,
            error: null,
        })
        const stops = [
            root.sub(bandwidthAtom, () => {}),
            root.sub(downloadSpeedAtom, () => {}),
            root.scope().sub(latencyAtom, () => {}),
            app().sub(measurementStatusAtom, () => {}),
        ]
        for (const stop of stops) stop()
        expect(net.runs).toEqual([])
        expect([
            root.get(downloadSpeedAtom),
            root.get(uploadSpeedAtom),
            root.get(latencyAtom),
            root.get(jitterAtom),
            root.get(lastMeasurementAtom),
        ]).toEqual([null, null, null, null, null])
    })

    test("a measurement publishes its phases and provisional readings, then the result", async () => {
        const root = app()
        const { seen } = watch(root)
        const answer = measureBandwidth()
        expect(net.runs).toHaveLength(1)
        expect(root.get(bandwidthAtom)).toMatchObject({
            status: "pending",
            phase: "latency",
            result: null,
        })
        const run = net.runs[0]!
        run.report("download", { latencyMs: 12, jitterMs: 1.5 })
        run.report("download", { downloadMbps: 80 })
        expect(root.get(bandwidthAtom).progress).toEqual({
            latencyMs: 12,
            jitterMs: 1.5,
            downloadMbps: 80,
            uploadMbps: null,
        })
        // Provisional readings are not results.
        expect(root.get(downloadSpeedAtom)).toBeNull()
        run.report("upload", { downloadMbps: 95 })
        const result = run.complete({ downloadMbps: 95, uploadMbps: 21 })
        expect(await answer).toBe(result)
        const state = root.get(bandwidthAtom)
        expect(state).toEqual({
            status: "ready",
            phase: null,
            progress: null,
            result,
            error: null,
        })
        expect(Object.isFrozen(state) && Object.isFrozen(result)).toBe(true)
        expect([
            root.get(downloadSpeedAtom),
            root.get(uploadSpeedAtom),
            root.get(latencyAtom),
            root.get(jitterAtom),
            root.get(lastMeasurementAtom),
        ]).toEqual([95, 21, 12, 1.5, result.timestamp])
        expect(seen).toEqual([
            "pending/latency",
            "pending/download",
            "pending/download",
            "pending/upload",
            "ready",
        ])
    })

    test("options are normalized with the documented defaults", async () => {
        void measureBandwidth().catch(() => {})
        expect(net.runs[0]!.options).toEqual({
            latencySamples: 10,
            maxDurationMs: 10_000,
            minDurationMs: 5_000,
            warmupMs: 2_000,
            startStreams: 2,
            maxStreams: 8,
            stabilityThreshold: 0.05,
        })
    })

    test("invalid options throw before anything is measured", () => {
        for (const options of [
            { latencySamples: 0 },
            { latencySamples: 1.5 },
            { startStreams: 4, maxStreams: 2 },
            { maxDurationMs: 0 },
            { minDurationMs: 2_000, maxDurationMs: 1_000 },
            { warmupMs: -1 },
            { stabilityThreshold: 0 },
            { maxStreams: "8" },
        ])
            expect(() => measureBandwidth(options as never)).toThrow(TypeError)
        expect(net.runs).toEqual([])
    })

    test("a repeated measurement keeps the previous result while running, then replaces it", async () => {
        const root = app()
        const first = measureBandwidth()
        const previous = net.runs[0]!.complete()
        await first
        const second = measureBandwidth()
        expect(root.get(bandwidthAtom)).toMatchObject({
            status: "pending",
            result: previous,
        })
        expect(root.get(downloadSpeedAtom)).toBe(previous.downloadMbps)
        const next = net.runs[1]!.complete({ downloadMbps: 300 })
        await second
        expect(root.get(bandwidthAtom).result).toBe(next)
    })
})

describe("failures", () => {
    test("a failure rejects with the request's error and keeps the previous result", async () => {
        const root = app()
        const first = measureBandwidth()
        const previous = net.runs[0]!.complete()
        await first
        const second = measureBandwidth()
        const error = new Error("upload failed: 500 Internal Server Error")
        net.runs[1]!.fail(error)
        await expect(second).rejects.toBe(error)
        expect(root.get(bandwidthAtom)).toEqual({
            status: "error",
            phase: null,
            progress: null,
            result: previous,
            error: {
                name: "Error",
                message: "upload failed: 500 Internal Server Error",
            },
        })
    })

    test("a failure is never retried automatically; the next explicit call is", async () => {
        const root = app()
        const failed = measureBandwidth()
        net.runs[0]!.fail()
        await failed.catch(() => {})
        await flush()
        expect(net.runs).toHaveLength(1)
        const retry = measureBandwidth()
        expect(root.get(bandwidthAtom)).toMatchObject({
            status: "pending",
            error: null,
        })
        net.runs[1]!.complete()
        await retry
        expect(root.get(measurementStatusAtom)).toBe("ready")
    })

    test("without fetch the state is unsupported and measuring rejects", async () => {
        const root = app()
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch")!
        delete (globalThis as { fetch?: unknown }).fetch
        try {
            expect(root.get(measurementStatusAtom)).toBe("unsupported")
            const error = await measureBandwidth().catch(
                (failure: unknown) => failure,
            )
            expect((error as Error).name).toBe("NotSupportedError")
        } finally {
            Object.defineProperty(globalThis, "fetch", descriptor)
        }
        expect(net.runs).toEqual([])
        expect(root.get(measurementStatusAtom)).toBe("idle")
    })
})

describe("concurrency", () => {
    test("concurrent calls share one measurement; a joining call's options are ignored", async () => {
        const first = measureBandwidth()
        const second = measureBandwidth({ maxStreams: 2, startStreams: 1 })
        expect(net.runs).toHaveLength(1)
        const result = net.runs[0]!.complete()
        expect(await Promise.all([first, second])).toEqual([result, result])
    })

    test("fresh replaces the running measurement; its callers reject with AbortError", async () => {
        const root = app()
        const old = measureBandwidth()
        const replacement = measureBandwidth({ fresh: true })
        expect(net.runs).toHaveLength(2)
        expect(net.runs[0]!.signal.aborted).toBe(true)
        const error = (await old.catch((failure: unknown) => failure)) as Error
        expect(error.name).toBe("AbortError")
        expect(root.get(bandwidthAtom)).toMatchObject({
            status: "pending",
            phase: "latency",
        })
        const result = net.runs[1]!.complete()
        expect(await replacement).toBe(result)
    })

    test("out of order: a replaced measurement's late readings and result change nothing", async () => {
        net.ignoreAbort = true
        const root = app()
        const old = measureBandwidth()
        const newer = measureBandwidth({ fresh: true })
        const result = net.runs[1]!.complete()
        await newer
        const { seen } = watch(root)
        net.runs[0]!.report("upload", { uploadMbps: 999 })
        net.runs[0]!.complete({ downloadMbps: 999 })
        await old.catch(() => {})
        await flush()
        expect(root.get(bandwidthAtom).result).toBe(result)
        expect(seen).toEqual([])
    })

    test("out of order: a replaced measurement's late failure cannot mark the newer result as failed", async () => {
        net.ignoreAbort = true
        const root = app()
        const old = measureBandwidth()
        const newer = measureBandwidth({ fresh: true })
        net.runs[1]!.complete()
        await newer
        net.runs[0]!.fail()
        await old.catch(() => {})
        await flush()
        expect(root.get(measurementStatusAtom)).toBe("ready")
    })
})

describe("cancellation", () => {
    test("a pre-aborted signal rejects without measuring or publishing", async () => {
        const root = app()
        const { seen } = watch(root)
        const reason = new Error("not now")
        await expect(
            measureBandwidth({ signal: AbortSignal.abort(reason) }),
        ).rejects.toBe(reason)
        expect(net.runs).toEqual([])
        expect(seen).toEqual([])
    })

    test("the only caller cancelling aborts the measurement and restores the previous state", async () => {
        const root = app()
        const first = measureBandwidth()
        net.runs[0]!.complete()
        await first
        const before = root.get(bandwidthAtom)
        const controller = new AbortController()
        const answer = measureBandwidth({ signal: controller.signal })
        net.runs[1]!.report("download", { latencyMs: 9 })
        controller.abort()
        expect(
            ((await answer.catch((failure: unknown) => failure)) as Error).name,
        ).toBe("AbortError")
        expect(net.runs[1]!.signal.aborted).toBe(true)
        expect(root.get(bandwidthAtom)).toBe(before)
        expect(inspectBandwidth().running).toBe(false)
    })

    test("one caller cancelling leaves the shared measurement running for the others", async () => {
        const controller = new AbortController()
        const cancelled = measureBandwidth({ signal: controller.signal })
        const kept = measureBandwidth({ signal: new AbortController().signal })
        controller.abort()
        await expect(cancelled).rejects.toBeDefined()
        expect(net.runs[0]!.signal.aborted).toBe(false)
        const result = net.runs[0]!.complete()
        expect(await kept).toBe(result)
    })

    test("a caller without a signal keeps the measurement alive when the others cancel", async () => {
        const controller = new AbortController()
        const pinned = measureBandwidth()
        const cancelled = measureBandwidth({ signal: controller.signal })
        controller.abort()
        await cancelled.catch(() => {})
        expect(net.runs[0]!.signal.aborted).toBe(false)
        const result = net.runs[0]!.complete()
        expect(await pinned).toBe(result)
    })

    test("readings and results that arrive after cancellation publish nothing", async () => {
        net.ignoreAbort = true
        const root = app()
        const { seen } = watch(root)
        const controller = new AbortController()
        const answer = measureBandwidth({ signal: controller.signal })
        controller.abort()
        await answer.catch(() => {})
        net.runs[0]!.report("download", { downloadMbps: 50 })
        net.runs[0]!.complete()
        await flush()
        expect(root.get(measurementStatusAtom)).toBe("idle")
        expect(seen).toEqual(["pending/latency", "idle"])
    })
})

describe("stores", () => {
    test("root, child scope and an independent store all observe the same measurement", async () => {
        const root = app()
        const child = root.scope()
        const other = app()
        const watchers = [watch(root), watch(child), watch(other)]
        const answer = measureBandwidth()
        const result = net.runs[0]!.complete()
        await answer
        for (const { seen } of watchers)
            expect(seen).toEqual(["pending/latency", "ready"])
        expect(
            [root, child, other, app()].map(
                target => target.get(bandwidthAtom).result,
            ),
        ).toEqual([result, result, result, result])
        expect(net.runs).toHaveLength(1)
    })

    test("each store tree registers once and releases on unsubscribe and dispose", () => {
        const root = app()
        const stopRoot = root.sub(bandwidthAtom, () => {})
        const stopChild = root.scope().sub(downloadSpeedAtom, () => {})
        const other = app()
        other.sub(measurementStatusAtom, () => {})
        expect(inspectBandwidth().registrations).toBe(2)
        stopRoot()
        stopChild()
        expect(inspectBandwidth().registrations).toBe(1)
        other.dispose()
        expect(inspectBandwidth().registrations).toBe(0)
    })

    test("a store disposed mid-measurement receives nothing more; the others do", async () => {
        const doomed = app()
        const kept = app()
        let doomedCalls = 0
        doomed.sub(bandwidthAtom, () => doomedCalls++)
        const { seen } = watch(kept)
        const answer = measureBandwidth()
        doomedCalls = 0
        doomed.dispose()
        net.runs[0]!.report("download", { latencyMs: 10 })
        net.runs[0]!.complete()
        await answer
        expect(doomedCalls).toBe(0)
        expect(seen).toEqual(["pending/latency", "pending/download", "ready"])
        expect(reports.reported).toEqual([])
    })

    test("unsubscribing or disposing a store never cancels the measurement", async () => {
        const root = app()
        const stop = root.sub(bandwidthAtom, () => {})
        const answer = measureBandwidth()
        stop()
        root.dispose()
        expect(net.runs[0]!.signal.aborted).toBe(false)
        net.runs[0]!.complete()
        await answer
        expect(app().get(measurementStatusAtom)).toBe("ready")
    })
})

describe("subscriber failures", () => {
    test("a throwing subscriber never changes the promise and never starves another store", async () => {
        const noisy = app()
        const quiet = app()
        noisy.sub(bandwidthAtom, () => {
            throw new Error("subscriber bug")
        })
        const { seen } = watch(quiet)
        const answer = measureBandwidth()
        const result = net.runs[0]!.complete()
        expect(await answer).toBe(result)
        await flush()
        expect(seen).toEqual(["pending/latency", "ready"])
        expect(reports.reported).toHaveLength(2)
        expect(
            reports.reported.every(
                error =>
                    (error as Error).name === "SubscriberNotificationError",
            ),
        ).toBe(true)
        expect(reports.unhandled).toEqual([])
        expect(net.runs).toHaveLength(1)
    })

    test("a measurement failure stays the promise's outcome when a subscriber throws", async () => {
        const noisy = app()
        noisy.sub(bandwidthAtom, () => {
            throw new Error("subscriber bug")
        })
        const answer = measureBandwidth()
        const error = new Error("latency probe failed: 429")
        net.runs[0]!.fail(error)
        await expect(answer).rejects.toBe(error)
        await flush()
        expect(noisy.get(measurementStatusAtom)).toBe("error")
        expect(reports.unhandled).toEqual([])
    })

    test("a measurement started inside a transaction is published once the transaction is over", async () => {
        const root = app()
        const trigger = atom(0)
        const { seen } = watch(root)
        let answer: Promise<unknown> | undefined
        root.txn(tx => {
            tx.set(trigger, 1)
            answer = measureBandwidth()
        })
        await flush(1)
        expect(seen).toEqual(["pending/latency"])
        net.runs[0]!.complete()
        await answer
        expect(reports.reported).toEqual([])
    })
})
