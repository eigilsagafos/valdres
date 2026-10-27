/**
 * The real measurement against a scripted `fetch` that answers inside the
 * process with small bodies: request shapes, phase order, abort behavior and
 * units. Nothing reaches a measurement server.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { bandwidthAtom } from "../atoms/bandwidthAtom"
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

beforeEach(() => {
    requests = []
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
            await new Promise(resolve => setTimeout(resolve, 1))
            init?.signal?.throwIfAborted()
            const bytes = Math.min(
                Number(/bytes=(\d+)/.exec(String(input))?.[1] ?? 0),
                CHUNK,
            )
            return new Response(new Uint8Array(bytes), { status: 200 })
        },
    })
})
afterEach(() => {
    forgetBandwidth()
    if (original === undefined) delete (globalThis as { fetch?: unknown }).fetch
    else Object.defineProperty(globalThis, "fetch", original)
})

const fast = {
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
            normalizeOptions(fast).options,
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
        const download = requests.filter(r =>
            r.url.endsWith("__down?bytes=100000000"),
        )
        const upload = requests.filter(r => r.url.endsWith("__up"))
        // One warm-up plus the samples.
        expect(latency).toHaveLength(4)
        expect(download.length).toBeGreaterThan(0)
        expect(upload.length).toBeGreaterThan(0)
        expect(
            upload.every(
                r =>
                    r.method === "POST" &&
                    (r.init?.body as Uint8Array).byteLength === 1_000_000,
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
            }).options,
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
            }).options,
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
        const mbps = await runPhase({
            worker: async (signal, reportBytes) => {
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
