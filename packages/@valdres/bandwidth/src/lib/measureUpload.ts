import { runPhase } from "./runPhase"
import type { RunPhaseOptions } from "./runPhase"

const URL = "https://speed.cloudflare.com/__up"
const CHUNK_BYTES = 1_000_000
const body = new Uint8Array(CHUNK_BYTES)

const uploadWorker = async (
    signal: AbortSignal,
    reportBytes: (bytes: number) => void,
): Promise<void> => {
    while (!signal.aborted) {
        const res = await fetch(URL, {
            method: "POST",
            body,
            cache: "no-store",
            signal,
        })
        if (!res.ok) {
            throw new Error(
                `upload failed: ${res.status} ${res.statusText}`.trim(),
            )
        }
        await res.arrayBuffer()
        if (signal.aborted) return
        reportBytes(CHUNK_BYTES)
    }
}

export const measureUpload = (
    options: Omit<RunPhaseOptions, "worker"> = {},
): Promise<number> => runPhase({ ...options, worker: uploadWorker })
