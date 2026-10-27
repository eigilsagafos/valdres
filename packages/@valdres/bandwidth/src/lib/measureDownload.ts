import { downloadUrl, REQUEST_INIT } from "./endpoints"
import {
    runPhase,
    type PhaseOutcome,
    type PhaseWorker,
    type RunPhaseOptions,
} from "./runPhase"

/** The most one request asks for; the phase's byte limit caps it further. */
const CHUNK_BYTES = 10_000_000

const downloadWorker =
    (download: string): PhaseWorker =>
    async (signal, transfer) => {
        while (!signal.aborted) {
            const bytes = transfer.reserve(CHUNK_BYTES)
            if (bytes === 0) return
            let received = 0
            try {
                const res = await fetch(downloadUrl(download, bytes), {
                    ...REQUEST_INIT,
                    signal,
                })
                if (!res.ok) {
                    throw new Error(
                        `download failed: ${res.status} ${res.statusText}`.trim(),
                    )
                }
                if (!res.body) {
                    // No streaming body: read once and stop this stream.
                    const buf = await res.arrayBuffer()
                    received = buf.byteLength
                    transfer.report(received)
                    return
                }
                const reader = res.body.getReader()
                while (!signal.aborted) {
                    const { done, value } = await reader.read()
                    if (done) break
                    received += value.byteLength
                    transfer.report(value.byteLength)
                }
            } finally {
                // A short (or cut-off) response leaves budget for the others.
                if (received < bytes) transfer.release(bytes - received)
            }
        }
    }

export const measureDownload = (
    download: string,
    options: Omit<RunPhaseOptions, "worker" | "phase"> = {},
): Promise<PhaseOutcome> =>
    runPhase({
        ...options,
        phase: "download",
        worker: downloadWorker(download),
    })
