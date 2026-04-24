import { runPhase } from "./runPhase"
import type { RunPhaseOptions } from "./runPhase"

const CHUNK_BYTES = 100_000_000
const URL = `https://speed.cloudflare.com/__down?bytes=${CHUNK_BYTES}`

const downloadWorker = async (
    signal: AbortSignal,
    reportBytes: (bytes: number) => void,
): Promise<void> => {
    while (!signal.aborted) {
        const res = await fetch(URL, { cache: "no-store", signal })
        if (!res.body) {
            const buf = await res.arrayBuffer()
            reportBytes(buf.byteLength)
            continue
        }
        const reader = res.body.getReader()
        while (!signal.aborted) {
            const { done, value } = await reader.read()
            if (done) break
            reportBytes(value.byteLength)
        }
    }
}

export const measureDownload = (
    options: Omit<RunPhaseOptions, "worker"> = {},
): Promise<number> => runPhase({ ...options, worker: downloadWorker })
