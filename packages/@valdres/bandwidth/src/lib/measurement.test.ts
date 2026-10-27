import { afterEach, describe, expect, test } from "bun:test"
import { bytesToMbps } from "./bytesToMbps"
import { median } from "./median"
import { stdDev } from "./stdDev"
import { BandwidthInsufficientDataError } from "../errors/BandwidthInsufficientDataError"
import { runPhase, type PhaseTransfer } from "./runPhase"
import { measureDownload } from "./measureDownload"
import { measureUpload } from "./measureUpload"
import { measureLatency } from "./measureLatency"

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

describe("runPhase", () => {
    test("stops early when samples stabilize", async () => {
        // Worker reports a steady rate so CoV drops below the threshold.
        const worker = async (
            signal: AbortSignal,
            { report: reportBytes }: PhaseTransfer,
        ) => {
            while (!signal.aborted) {
                await new Promise(r => setTimeout(r, 10))
                reportBytes(1_000_000)
            }
        }

        const start = Date.now()
        const { mbps, endedBy } = await runPhase({
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
        expect(endedBy).toBe("stable")
        // Should stop well before maxDurationMs (2s) once stable.
        expect(elapsed).toBeLessThan(1_000)
    })

    test("respects maxDurationMs when rate never stabilizes", async () => {
        let tick = 0
        const worker = async (
            signal: AbortSignal,
            { report: reportBytes }: PhaseTransfer,
        ) => {
            while (!signal.aborted) {
                await new Promise(r => setTimeout(r, 10))
                // Erratic bytes — CoV stays high.
                reportBytes(tick++ % 2 === 0 ? 100_000 : 10_000_000)
            }
        }

        const start = Date.now()
        const { endedBy } = await runPhase({
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
        expect(endedBy).toBe("time")
    })

    test("aborts promptly on external signal mid-sleep", async () => {
        const worker = async (
            signal: AbortSignal,
            { report: reportBytes }: PhaseTransfer,
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

    test("ends promptly when all workers resolve without an abort", async () => {
        // A worker that exits after a single report — mirrors measureDownload's
        // non-streaming fallback. The phase has nothing left to measure once
        // every worker has resolved, so it shouldn't sit waiting for
        // minDurationMs/maxDurationMs.
        const worker = async (
            _signal: AbortSignal,
            { report: reportBytes }: PhaseTransfer,
        ) => {
            await new Promise(r => setTimeout(r, 10))
            reportBytes(1024)
        }

        const start = Date.now()
        // 1 KB in ~10 ms, before one 50 ms sampling interval: no usable
        // reading, which is neither a result nor a cancellation.
        const error = await runPhase({
            worker,
            phase: "upload",
            maxDurationMs: 2_000,
            minDurationMs: 1_000,
            warmupMs: 0,
            sampleIntervalMs: 50,
            startStreams: 1,
            maxStreams: 1,
        }).catch((failure: unknown) => failure)
        expect(error).toBeInstanceOf(BandwidthInsufficientDataError)
        expect((error as BandwidthInsufficientDataError).phase).toBe("upload")
        expect((error as BandwidthInsufficientDataError).bytes).toBe(1024)
        // Phase should end soon after the worker finishes, well before
        // minDurationMs (1s) — not run out the full clock.
        expect(Date.now() - start).toBeLessThan(500)
    })

    test("rethrows worker errors that occur outside an abort", async () => {
        const worker = async () => {
            await new Promise(r => setTimeout(r, 5))
            throw new Error("worker exploded")
        }

        await expect(
            runPhase({
                worker,
                maxDurationMs: 1_000,
                minDurationMs: 50,
                warmupMs: 0,
                sampleIntervalMs: 20,
                startStreams: 1,
                maxStreams: 1,
            }),
        ).rejects.toThrow("worker exploded")
    })
})

describe("response validation", () => {
    const originalFetch = globalThis.fetch
    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    test("measureLatency throws on non-OK response", async () => {
        globalThis.fetch = (async () =>
            new Response("rate limited", { status: 429 })) as typeof fetch

        await expect(
            measureLatency("https://speed.test/__down", 1),
        ).rejects.toThrow(/429/)
    })

    test("measureDownload throws on non-OK response", async () => {
        globalThis.fetch = (async () =>
            new Response("server error", { status: 503 })) as typeof fetch

        await expect(
            measureDownload("https://speed.test/__down", {
                maxDurationMs: 200,
                minDurationMs: 50,
                warmupMs: 0,
                startStreams: 1,
                maxStreams: 1,
            }),
        ).rejects.toThrow(/503/)
    })

    test("measureUpload throws on non-OK response", async () => {
        globalThis.fetch = (async () =>
            new Response("nope", { status: 500 })) as typeof fetch

        await expect(
            measureUpload("https://speed.test/__up", {
                maxDurationMs: 200,
                minDurationMs: 50,
                warmupMs: 0,
                startStreams: 1,
                maxStreams: 1,
            }),
        ).rejects.toThrow(/500/)
    })

    test("measureDownload non-streaming fallback runs once and returns", async () => {
        // Simulate a runtime where res.body is null (no streaming). The old
        // code looped, allocating ~100MB per fetch — we only want one call.
        let calls = 0
        globalThis.fetch = (async () => {
            calls++
            await new Promise(r => setTimeout(r, 60))
            // A bare Response object whose body getter returns null while
            // arrayBuffer() still resolves — mimics a runtime without
            // streaming bodies.
            return {
                ok: true,
                status: 200,
                statusText: "OK",
                body: null,
                arrayBuffer: async () => new ArrayBuffer(1024),
            } as unknown as Response
        }) as typeof fetch

        const outcome = await measureDownload("https://speed.test/__down", {
            maxDurationMs: 300,
            minDurationMs: 50,
            warmupMs: 0,
            sampleIntervalMs: 30,
            startStreams: 1,
            maxStreams: 1,
        })
        // One per started stream, no looping; an average over what arrived.
        expect(calls).toBe(1)
        expect(outcome).toMatchObject({ bytes: 1024, endedBy: "drained" })
    })
})
