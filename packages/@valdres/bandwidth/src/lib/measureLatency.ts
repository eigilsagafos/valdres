const URL = "https://speed.cloudflare.com/__down?bytes=0"

const ping = async (signal?: AbortSignal): Promise<number> => {
    const start = performance.now()
    const res = await fetch(URL, { cache: "no-store", signal })
    if (!res.ok) {
        throw new Error(
            `latency probe failed: ${res.status} ${res.statusText}`.trim(),
        )
    }
    await res.arrayBuffer()
    return performance.now() - start
}

export const measureLatency = async (
    samples: number,
    signal?: AbortSignal,
): Promise<number[]> => {
    // Warm-up request — absorbs DNS + TLS + connection setup so the measured
    // samples reflect RTT only. Always one extra request beyond `samples`.
    await ping(signal)

    const results: number[] = []
    for (let i = 0; i < samples; i++) {
        results.push(await ping(signal))
    }
    return results
}
