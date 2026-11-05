import { downloadUrl, REQUEST_INIT } from "./endpoints"

const ping = async (
    download: string,
    signal?: AbortSignal,
): Promise<number> => {
    const start = performance.now()
    const res = await fetch(downloadUrl(download, 0), {
        ...REQUEST_INIT,
        signal,
    })
    if (!res.ok) {
        throw new Error(
            `latency probe failed: ${res.status} ${res.statusText}`.trim(),
        )
    }
    await res.arrayBuffer()
    return performance.now() - start
}

export const measureLatency = async (
    download: string,
    samples: number,
    signal?: AbortSignal,
): Promise<number[]> => {
    // Warm-up request — absorbs DNS + TLS + connection setup so the measured
    // samples reflect RTT only. Always one extra request beyond `samples`.
    await ping(download, signal)

    const results: number[] = []
    for (let i = 0; i < samples; i++) {
        signal?.throwIfAborted()
        results.push(await ping(download, signal))
    }
    return results
}
