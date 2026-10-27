import { REQUEST_INIT } from "./endpoints"
import {
    runPhase,
    type PhaseOutcome,
    type PhaseWorker,
    type RunPhaseOptions,
} from "./runPhase"

/** The most one request sends; the phase's byte limit caps it further. */
const CHUNK_BYTES = 1_000_000
// Allocated by the first upload, never at import.
let chunk: Uint8Array<ArrayBuffer> | undefined

const uploadWorker =
    (upload: string): PhaseWorker =>
    async (signal, transfer) => {
        while (!signal.aborted) {
            const bytes = transfer.reserve(CHUNK_BYTES)
            if (bytes === 0) return
            let sent = false
            try {
                chunk ??= new Uint8Array(CHUNK_BYTES)
                const res = await fetch(upload, {
                    ...REQUEST_INIT,
                    method: "POST",
                    body:
                        bytes === CHUNK_BYTES
                            ? chunk
                            : chunk.subarray(0, bytes),
                    signal,
                })
                if (!res.ok) {
                    throw new Error(
                        `upload failed: ${res.status} ${res.statusText}`.trim(),
                    )
                }
                await res.arrayBuffer()
                if (signal.aborted) return
                sent = true
                transfer.report(bytes)
            } finally {
                if (!sent) transfer.release(bytes)
            }
        }
    }

export const measureUpload = (
    upload: string,
    options: Omit<RunPhaseOptions, "worker" | "phase"> = {},
): Promise<PhaseOutcome> =>
    runPhase({ ...options, phase: "upload", worker: uploadWorker(upload) })
