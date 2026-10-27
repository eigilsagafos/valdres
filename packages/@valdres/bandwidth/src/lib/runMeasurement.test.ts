/**
 * The real measurement against a scripted `fetch` that answers inside the
 * process with small bodies: request shapes, phase order, abort behavior and
 * units. Nothing reaches a measurement server.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"
import { BandwidthInsufficientDataError } from "../errors/BandwidthInsufficientDataError"
import type { BandwidthProgress } from "../types/BandwidthProgress"
import type { MeasurementPhase } from "../types/MeasurementPhase"
import { measureBandwidth } from "../utils/measureBandwidth"
import { forgetBandwidth } from "./measurementRecord"
import { normalizeOptions } from "./normalizeOptions"
import { runMeasurement } from "./runMeasurement"
import { runPhase } from "./runPhase"

interface Request {
    readonly url: string
    readonly method: string
    readonly init: RequestInit | undefined
}

let requests: Request[]
let original: PropertyDescriptor | undefined
const CHUNK = 65_536
/** Body bytes the scripted server sends for a `bytes=N` request. */
let respond: (requested: number) => number
/** How long the scripted server takes per request, ms. */
let delayMs: number

/** The `bytes=N` a download or latency request asked for. */
const requestedBytes = (url: string) =>
    Number(/bytes=(\d+)/.exec(url)?.[1] ?? 0)

beforeEach(() => {
    requests = []
    respond = requested => Math.min(requested, CHUNK)
    delayMs = 1
    original = Object.getOwnPropertyDescriptor(globalThis, "fetch")
    Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: async (input: unknown, init?: RequestInit) => {
            requests.push({
                url: String(input),
                method: init?.method ?? "GET",
                init,
            })
            // A real yield, so the phase timers can run.
            await new Promise(resolve => setTimeout(resolve, delayMs))
            init?.signal?.throwIfAborted()
            const bytes = respond(requestedBytes(String(input)))
            return new Response(new Uint8Array(bytes), { status: 200 })
        },
    })
})
afterEach(() => {
    forgetBandwidth()
    if (original === undefined) delete (globalThis as { fetch?: unknown }).fetch
    else Object.defineProperty(globalThis, "fetch", original)
})

// Time-bounded: the byte limits are lifted so an in-process server cannot
// exhaust them before one sampling interval.
const fast = {
    maxDownloadBytes: Infinity,
    maxUploadBytes: Infinity,
    latencySamples: 3,
    maxDurationMs: 120,
    minDurationMs: 60,
    warmupMs: 0,
    startStreams: 1,
    maxStreams: 1,
}

describe("runMeasurement", () => {
    test("measures latency, download and upload in order with privacy-preserving requests", async () => {
        const phases: MeasurementPhase[] = []
        const readings: BandwidthProgress[] = []
        const result = await runMeasurement(
            normalizeOptions(fast).config,
            new AbortController().signal,
            (phase, progress) => {
                if (phases.at(-1) !== phase) phases.push(phase)
                readings.push(progress)
            },
        )
        expect(phases).toEqual(["latency", "download", "upload"])
        expect(result.downloadMbps).toBeGreaterThan(0)
        expect(result.uploadMbps).toBeGreaterThan(0)
        expect(result.latencyMs).toBeGreaterThan(0)
        expect(result.jitterMs).toBeGreaterThanOrEqual(0)
        expect(Object.isFrozen(result)).toBe(true)
        expect(readings.every(Object.isFrozen)).toBe(true)

        const latency = requests.filter(r => r.url.endsWith("__down?bytes=0"))
        const download = requests.filter(r => /__down\?bytes=[1-9]/.test(r.url))
        const upload = requests.filter(r => r.url.endsWith("__up"))
        // One warm-up plus the samples.
        expect(latency).toHaveLength(4)
        expect(download.length).toBeGreaterThan(0)
        expect(upload.length).toBeGreaterThan(0)
        expect(
            upload.every(
                r =>
                    r.method === "POST" &&
                    (r.init?.body as Uint8Array).byteLength <= 1_000_000,
            ),
        ).toBe(true)
        expect(requests.length).toBe(
            latency.length + download.length + upload.length,
        )
        for (const { url, init } of requests) {
            expect(url.startsWith("https://speed.cloudflare.com/")).toBe(true)
            expect(init).toMatchObject({
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer",
            })
        }
    })

    test("an abort during the download phase rejects; it never reports a partial result or starts uploading", async () => {
        const controller = new AbortController()
        const reason = new Error("stop")
        const answer = runMeasurement(
            normalizeOptions({
                ...fast,
                maxDurationMs: 2_000,
                minDurationMs: 1_000,
            }).config,
            controller.signal,
            phase => {
                if (phase === "download")
                    setTimeout(() => controller.abort(reason), 30)
            },
        )
        await expect(answer).rejects.toBe(reason)
        expect(requests.some(r => r.url.endsWith("__up"))).toBe(false)
    })

    test("an abort during the upload phase rejects promptly", async () => {
        const controller = new AbortController()
        let uploading: number | undefined
        const answer = runMeasurement(
            normalizeOptions({
                ...fast,
                maxDurationMs: 5_000,
                minDurationMs: 100,
            }).config,
            controller.signal,
            phase => {
                if (phase !== "upload" || uploading !== undefined) return
                uploading = performance.now()
                setTimeout(() => controller.abort(), 20)
            },
        )
        expect(
            ((await answer.catch((failure: unknown) => failure)) as Error).name,
        ).toBe("AbortError")
        // Well before the phase's 5 s limit.
        expect(performance.now() - uploading!).toBeLessThan(1_000)
    })

    test("throughput is reported in megabits per second", async () => {
        // 125,000 bytes every 10 ms is 100 Mbps.
        const { mbps } = await runPhase({
            worker: async (signal, { report: reportBytes }) => {
                while (!signal.aborted) {
                    await new Promise(resolve => setTimeout(resolve, 10))
                    reportBytes(125_000)
                }
            },
            maxDurationMs: 400,
            minDurationMs: 400,
            warmupMs: 0,
            sampleIntervalMs: 50,
            windowMs: 200,
            startStreams: 1,
            maxStreams: 1,
        })
        // Timer drift only ever slows the worker down.
        expect(mbps).toBeGreaterThan(50)
        expect(mbps).toBeLessThan(110)
    })
})

describe("transfer limits", () => {
    // Paced so a phase lasts longer than one 250 ms sampling interval.
    beforeEach(() => {
        delayMs = 150
    })
    const run = (options: Record<string, unknown>) =>
        runMeasurement(
            normalizeOptions({
                ...fast,
                maxDurationMs: 5_000,
                minDurationMs: 5_000,
                ...options,
            }).config,
            new AbortController().signal,
            () => {},
        )
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

    test("the download limit caps what is requested and ends the phase on its average rate", async () => {
        // The server sends every byte asked for, at most 64 KB per request.
        const result = await run({
            maxDownloadBytes: 200_000,
            maxUploadBytes: 2_500_000,
        })
        const asked = requests
            .filter(r => /__down\?bytes=[1-9]/.test(r.url))
            .map(r => requestedBytes(r.url))
        expect(result.downloadEndedBy).toBe("bytes")
        expect(result.downloadBytes).toBe(200_000)
        // Never more outstanding than the budget left: short answers return
        // their unused reservation before more is asked.
        expect(Math.max(...asked)).toBeLessThanOrEqual(200_000)
        expect(result.downloadMbps).toBeGreaterThan(0)
    })

    test("the upload limit caps the bytes sent, down to a partial last chunk", async () => {
        const result = await run({
            maxDownloadBytes: 200_000,
            maxUploadBytes: 2_500_000,
        })
        const sizes = requests
            .filter(r => r.method === "POST")
            .map(r => (r.init?.body as Uint8Array).byteLength)
        expect(sum(sizes)).toBe(2_500_000)
        expect(sizes).toEqual([1_000_000, 1_000_000, 500_000])
        expect(result).toMatchObject({
            uploadBytes: 2_500_000,
            uploadEndedBy: "bytes",
        })
    })

    test("a server that ignores the requested size is cut off at the limit", async () => {
        respond = requested => (requested === 0 ? 0 : 1_000_000)
        delayMs = 300
        const result = await run({
            maxDownloadBytes: 300_000,
            maxUploadBytes: 1_000_000,
            startStreams: 1,
            maxStreams: 1,
        })
        expect(result.downloadEndedBy).toBe("bytes")
        // Reading stops at the limit (plus at most the chunk that crossed it).
        expect(result.downloadBytes).toBeGreaterThanOrEqual(300_000)
        expect(result.downloadBytes).toBeLessThan(300_000 + 1_000_000)
        expect(
            requests.filter(r => /__down\?bytes=[1-9]/.test(r.url)),
        ).toHaveLength(1)
    })

    test("Infinity lifts a limit; the time limit still ends the phase", async () => {
        const result = await run({
            maxDownloadBytes: Infinity,
            maxUploadBytes: Infinity,
            maxDurationMs: 300,
            minDurationMs: 300,
        })
        expect(result.downloadEndedBy).toBe("time")
    })

    test("cancellation stops scheduling transfers", async () => {
        const controller = new AbortController()
        let aborted = -1
        const answer = runMeasurement(
            normalizeOptions({
                ...fast,
                maxDurationMs: 5_000,
                minDurationMs: 5_000,
                maxDownloadBytes: Infinity,
            }).config,
            controller.signal,
            phase => {
                if (phase !== "download" || aborted !== -1) return
                setTimeout(() => {
                    controller.abort()
                    aborted = requests.length
                }, 30)
            },
        )
        await answer.catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(aborted).toBeGreaterThan(0)
        expect(requests.length).toBe(aborted)
    })

    test("a phase without usable data rejects with BandwidthInsufficientDataError", async () => {
        respond = () => 0
        const error = await run({ maxDurationMs: 400, minDurationMs: 0 }).catch(
            (failure: unknown) => failure,
        )
        expect(error).toBeInstanceOf(BandwidthInsufficientDataError)
        expect(error).toMatchObject({
            phase: "download",
            bytes: 0,
            code: "VALDRES_BANDWIDTH_INSUFFICIENT_DATA",
        })
        expect(requests.some(r => r.method === "POST")).toBe(false)
    })
})

describe("endpoints", () => {
    test("a configured server receives every request, with bytes appended to an existing query", async () => {
        await runMeasurement(
            normalizeOptions({
                ...fast,
                endpoints: {
                    download: "https://speed.test/down?token=t",
                    upload: "https://speed.test/up",
                },
            }).config,
            new AbortController().signal,
            () => {},
        )
        expect(
            requests.every(r => r.url.startsWith("https://speed.test/")),
        ).toBe(true)
        expect(
            requests.filter(
                r => r.url === "https://speed.test/down?token=t&bytes=0",
            ),
        ).toHaveLength(4)
        expect(
            requests.some(r =>
                /^https:\/\/speed\.test\/down\?token=t&bytes=[1-9]/.test(r.url),
            ),
        ).toBe(true)
        expect(
            requests
                .filter(r => r.method === "POST")
                .every(r => r.url === "https://speed.test/up"),
        ).toBe(true)
    })

    test("both URLs are required", () => {
        for (const endpoints of [
            { download: "https://speed.test/down" },
            { download: "", upload: "x" },
            "https://speed.test",
        ])
            expect(() => normalizeOptions({ endpoints } as never)).toThrow(
                TypeError,
            )
    })
})

describe("measureBandwidth with the real runner", () => {
    test("publishes each phase and resolves the same result the state holds", async () => {
        const app = store()
        const phases: string[] = []
        app.sub(bandwidthAtom, () => {
            const { status, phase } = app.get(bandwidthAtom)
            const label = phase === null ? status : `${status}/${phase}`
            if (phases.at(-1) !== label) phases.push(label)
        })
        const result = await measureBandwidth(fast)
        expect(app.get(bandwidthAtom).result).toBe(result)
        expect(phases).toEqual([
            "pending/latency",
            "pending/download",
            "pending/upload",
            "ready",
        ])
        app.dispose()
    })
})
