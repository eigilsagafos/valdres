import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { atom, store } from "valdres"
import { bytesToMbps } from "./lib/bytesToMbps"
import { median } from "./lib/median"
import { stdDev } from "./lib/stdDev"
import { measurementCache } from "./lib/measurementCache"
import { runPhase } from "./lib/runPhase"
import { measureBandwidth } from "./utils/measureBandwidth"
import { invalidateMeasurement } from "./utils/invalidateMeasurement"
import { downloadSpeedAtom } from "./atoms/downloadSpeedAtom"
import { measurementStatusAtom } from "./atoms/measurementStatusAtom"
import { lastMeasurementAtom } from "./atoms/lastMeasurementAtom"
import { invalidateOnAtom } from "./atoms/invalidateOnAtom"
import { resetGlobals } from "../test/setup/resetGlobals"

describe("bytesToMbps", () => {
    test("1 MB in 1 second = 8 Mbps", () => {
        expect(bytesToMbps(1_000_000, 1)).toBe(8)
    })

    test("returns 0 when seconds is 0 or negative", () => {
        expect(bytesToMbps(1_000_000, 0)).toBe(0)
        expect(bytesToMbps(1_000_000, -1)).toBe(0)
    })

    test("12.5 MB in 1 second = 100 Mbps", () => {
        expect(bytesToMbps(12_500_000, 1)).toBe(100)
    })
})

describe("median", () => {
    test("odd-length returns middle", () => {
        expect(median([3, 1, 2])).toBe(2)
    })

    test("even-length returns average of middle two", () => {
        expect(median([1, 2, 3, 4])).toBe(2.5)
    })

    test("returns 0 on empty input", () => {
        expect(median([])).toBe(0)
    })
})

describe("stdDev", () => {
    test("returns 0 for fewer than 2 values", () => {
        expect(stdDev([])).toBe(0)
        expect(stdDev([5])).toBe(0)
    })

    test("computes std deviation", () => {
        expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2)
    })
})

describe("measureBandwidth (mocked fetch)", () => {
    const originalFetch = globalThis.fetch

    const mockFetch = (): typeof fetch =>
        (async (input: RequestInfo | URL, init?: RequestInit) => {
            // Real yield so the phase's setTimeout can fire — otherwise an
            // instantly-resolving fetch starves the macrotask queue.
            await new Promise(r => setTimeout(r, 0))
            if (init?.signal?.aborted) {
                throw Object.assign(new Error("aborted"), { name: "AbortError" })
            }
            const url = typeof input === "string" ? input : input.toString()
            const match = url.match(/bytes=(\d+)/)
            const requested = match ? Number(match[1]) : 0
            const bytes = Math.min(requested, 65_536)
            return new Response(new Uint8Array(bytes), { status: 200 })
        }) as typeof fetch

    const fastOptions = {
        latencySamples: 3,
        maxDurationMs: 300,
        minDurationMs: 150,
        warmupMs: 0,
        startStreams: 1,
        maxStreams: 1,
    }

    beforeEach(resetGlobals)

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    test("fills atoms after a successful measurement", async () => {
        const s = store()
        globalThis.fetch = mockFetch()

        const result = await measureBandwidth(fastOptions)

        expect(result.downloadMbps).toBeGreaterThan(0)
        expect(result.uploadMbps).toBeGreaterThan(0)
        expect(result.timestamp).toBeGreaterThan(0)
        expect(s.get(measurementStatusAtom)).toBe("complete")
        expect(s.get(lastMeasurementAtom)).toBe(result.timestamp)
    })

    test("reusing measureBandwidth returns cached promise", async () => {
        globalThis.fetch = mockFetch()
        const first = measureBandwidth(fastOptions)
        const second = measureBandwidth()
        expect(second).toBe(first)
        await first
    })

    test("fresh: true forces a new measurement", async () => {
        globalThis.fetch = mockFetch()
        const first = measureBandwidth(fastOptions)
        await first
        const second = measureBandwidth({ ...fastOptions, fresh: true })
        expect(second).not.toBe(first)
        await second
    })

    test("sets status to error on failure", async () => {
        const s = store()
        globalThis.fetch = (async () => {
            throw new Error("network down")
        }) as typeof fetch

        await expect(
            measureBandwidth({ ...fastOptions, latencySamples: 1 }),
        ).rejects.toThrow("network down")
        expect(s.get(measurementStatusAtom)).toBe("error")
        expect(measurementCache.promise).toBeNull()
    })

    test("pre-aborted signal rejects quickly without running phases", async () => {
        globalThis.fetch = mockFetch()
        const external = new AbortController()
        external.abort()
        const start = Date.now()
        await expect(
            measureBandwidth({ ...fastOptions, signal: external.signal }),
        ).rejects.toBeDefined()
        // Should reject fast — not wait through the full phase duration.
        expect(Date.now() - start).toBeLessThan(100)
    })
})

describe("invalidation", () => {
    const originalFetch = globalThis.fetch

    const mockFetch = (): typeof fetch =>
        (async (input: RequestInfo | URL, init?: RequestInit) => {
            await new Promise(r => setTimeout(r, 0))
            if (init?.signal?.aborted) {
                throw Object.assign(new Error("aborted"), {
                    name: "AbortError",
                })
            }
            const url = typeof input === "string" ? input : input.toString()
            const match = url.match(/bytes=(\d+)/)
            const requested = match ? Number(match[1]) : 0
            const bytes = Math.min(requested, 65_536)
            return new Response(new Uint8Array(bytes), { status: 200 })
        }) as typeof fetch

    beforeEach(resetGlobals)

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    test("invalidateMeasurement clears cache", () => {
        const fakePromise = Promise.resolve({
            downloadMbps: 1,
            uploadMbps: 1,
            latencyMs: 1,
            jitterMs: 0,
            timestamp: Date.now(),
        })
        measurementCache.promise = fakePromise as never
        measurementCache.controller = new AbortController()

        invalidateMeasurement()

        // ensureMeasurement fires a fresh measurement because a prior cache
        // existed — but no fetch mock is installed, so that real measurement
        // will settle (reject) in the background. Cache may be populated by
        // that new measurement; we only care that the old promise was cleared.
        expect(measurementCache.promise).not.toBe(fakePromise)
    })

    test("changing a watched atom invalidates in-flight measurement", async () => {
        const s = store()
        const triggerAtom = atom(0, {
            global: true,
            name: "test-trigger",
        })

        invalidateOnAtom.setSelf([triggerAtom])

        // Subscribe to a value atom so its onMount runs and
        // setupInvalidation wires the watchers. measurementStatusAtom
        // has no onMount.
        const unsubSpeed = s.sub(downloadSpeedAtom, () => {})

        // Seed a cache entry to stand in for an in-flight measurement.
        const stale = Promise.resolve({
            downloadMbps: 1,
            uploadMbps: 1,
            latencyMs: 1,
            jitterMs: 0,
            timestamp: 1,
        })
        measurementCache.promise = stale as never
        const staleController = new AbortController()
        measurementCache.controller = staleController

        // Fire a change on the watched atom.
        triggerAtom.setSelf(1)

        // Give the subscription callback a tick to run.
        await new Promise(r => setTimeout(r, 0))

        expect(staleController.signal.aborted).toBe(true)
        expect(measurementCache.promise).not.toBe(stale)
        unsubSpeed()
    })

    test("invalidation wires up after a speed atom is subscribed", async () => {
        const s = store()
        const triggerAtom = atom(0, {
            global: true,
            name: "test-trigger-no-speed",
        })

        invalidateOnAtom.setSelf([triggerAtom])

        // Under the mount-tied lifecycle, a speed atom subscription
        // is what runs setupInvalidation and wires the watchers.
        const unsubSpeed = s.sub(downloadSpeedAtom, () => {})

        const stale = Promise.resolve({
            downloadMbps: 1,
            uploadMbps: 1,
            latencyMs: 1,
            jitterMs: 0,
            timestamp: 1,
        })
        measurementCache.promise = stale as never
        const staleController = new AbortController()
        measurementCache.controller = staleController

        triggerAtom.setSelf(1)
        await new Promise(r => setTimeout(r, 0))

        expect(staleController.signal.aborted).toBe(true)
        unsubSpeed()
    })

    test("atoms added mid-run to invalidateOnAtom trigger invalidation", async () => {
        const s = store()
        const triggerAtom = atom(0, {
            global: true,
            name: "test-trigger-mid-run",
        })

        // Start with empty watch list. Subscribe to a speed atom so
        // setupInvalidation wires up under the mount-tied lifecycle.
        invalidateOnAtom.setSelf([])
        const unsubSpeed = s.sub(downloadSpeedAtom, () => {})

        const stale = Promise.resolve({
            downloadMbps: 1,
            uploadMbps: 1,
            latencyMs: 1,
            jitterMs: 0,
            timestamp: 1,
        })
        measurementCache.promise = stale as never
        const staleController = new AbortController()
        measurementCache.controller = staleController

        // Mid-run: add the trigger atom to the watch list.
        invalidateOnAtom.setSelf([triggerAtom])
        await new Promise(r => setTimeout(r, 0))

        // Before adding, changing triggerAtom would not invalidate. Now it should.
        triggerAtom.setSelf(1)
        await new Promise(r => setTimeout(r, 0))

        expect(staleController.signal.aborted).toBe(true)
        unsubSpeed()
    })

    test("atoms removed from invalidateOnAtom stop triggering invalidation", async () => {
        const s = store()
        const triggerAtom = atom(0, {
            global: true,
            name: "test-trigger-removed",
        })

        invalidateOnAtom.setSelf([triggerAtom])
        const unsubSpeed = s.sub(downloadSpeedAtom, () => {})

        // Remove the trigger from the watch list.
        invalidateOnAtom.setSelf([])
        await new Promise(r => setTimeout(r, 0))

        const stale = Promise.resolve({
            downloadMbps: 1,
            uploadMbps: 1,
            latencyMs: 1,
            jitterMs: 0,
            timestamp: 1,
        })
        measurementCache.promise = stale as never
        const staleController = new AbortController()
        measurementCache.controller = staleController

        triggerAtom.setSelf(1)
        await new Promise(r => setTimeout(r, 0))

        expect(staleController.signal.aborted).toBe(false)
        unsubSpeed()
    })

    test("invalidation mid-run does not leave status on 'error'", async () => {
        const s = store()
        globalThis.fetch = mockFetch()

        const triggerAtom = atom(0, {
            global: true,
            name: "test-trigger-no-error",
        })
        invalidateOnAtom.setSelf([triggerAtom])

        // Start a real measurement, then invalidate while the latency phase
        // is still in flight so the aborted fetch rejects with AbortError.
        const first = measureBandwidth({
            latencySamples: 3,
            maxDurationMs: 300,
            minDurationMs: 150,
            warmupMs: 0,
            startStreams: 1,
            maxStreams: 1,
        }).catch(() => {})
        triggerAtom.setSelf(1)

        // Abort the follow-up measurement that invalidateMeasurement starts —
        // we only care about the aborted first run's status side-effect.
        await first
        measurementCache.controller?.abort()

        expect(s.get(measurementStatusAtom)).not.toBe("error")
    })
})

describe("runPhase", () => {
    test("stops early when samples stabilize", async () => {
        // Worker reports a steady rate so CoV drops below the threshold.
        const worker = async (
            signal: AbortSignal,
            reportBytes: (bytes: number) => void,
        ) => {
            while (!signal.aborted) {
                await new Promise(r => setTimeout(r, 10))
                reportBytes(1_000_000)
            }
        }

        const start = Date.now()
        const mbps = await runPhase({
            worker,
            maxDurationMs: 2_000,
            minDurationMs: 100,
            warmupMs: 0,
            sampleIntervalMs: 30,
            stabilityWindowSize: 3,
            stabilityThreshold: 0.2,
            startStreams: 1,
            maxStreams: 1,
            windowMs: 100,
        })
        const elapsed = Date.now() - start

        expect(mbps).toBeGreaterThan(0)
        // Should stop well before maxDurationMs (2s) once stable.
        expect(elapsed).toBeLessThan(1_000)
    })

    test("respects maxDurationMs when rate never stabilizes", async () => {
        let tick = 0
        const worker = async (
            signal: AbortSignal,
            reportBytes: (bytes: number) => void,
        ) => {
            while (!signal.aborted) {
                await new Promise(r => setTimeout(r, 10))
                // Erratic bytes — CoV stays high.
                reportBytes(tick++ % 2 === 0 ? 100_000 : 10_000_000)
            }
        }

        const start = Date.now()
        await runPhase({
            worker,
            maxDurationMs: 200,
            minDurationMs: 50,
            warmupMs: 0,
            sampleIntervalMs: 20,
            stabilityWindowSize: 20,
            stabilityThreshold: 0.001,
            startStreams: 1,
            maxStreams: 1,
            windowMs: 50,
        })
        const elapsed = Date.now() - start
        // Reached maxDurationMs, not significantly beyond.
        expect(elapsed).toBeGreaterThanOrEqual(180)
        expect(elapsed).toBeLessThan(400)
    })

    test("aborts promptly on external signal mid-sleep", async () => {
        const worker = async (
            signal: AbortSignal,
            reportBytes: (bytes: number) => void,
        ) => {
            while (!signal.aborted) {
                await new Promise(r => setTimeout(r, 10))
                reportBytes(1_000_000)
            }
        }

        const external = new AbortController()
        const start = Date.now()
        setTimeout(() => external.abort(), 50)
        await runPhase({
            worker,
            maxDurationMs: 10_000,
            minDurationMs: 5_000,
            warmupMs: 0,
            sampleIntervalMs: 500,
            startStreams: 1,
            maxStreams: 1,
            signal: external.signal,
        })
        // Must not wait out the 500ms sampleInterval (or the 10s max).
        expect(Date.now() - start).toBeLessThan(300)
    })
})
