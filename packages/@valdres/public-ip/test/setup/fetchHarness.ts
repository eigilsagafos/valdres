/**
 * A scripted `fetch`: every call is recorded and stays pending until the test
 * answers it, so ordering, cancellation and late responses are explicit. No
 * request ever leaves the process. Addresses are from the documentation
 * ranges (RFC 5737 / RFC 3849).
 */
export interface FetchCall {
    readonly url: string
    readonly init: RequestInit | undefined
    readonly signal: AbortSignal | undefined
    /** Answers with a body and status (default 200). */
    respond(body: string, status?: number): void
    /** Rejects like a network failure. */
    fail(error?: unknown): void
    /** Whether the call has been answered, failed or aborted. */
    readonly settled: boolean
}

export interface FetchHarness {
    readonly calls: FetchCall[]
    /**
     * When true, aborting a call's signal does NOT reject it: models a response
     * that was already completing when the abort arrived.
     */
    ignoreAbort: boolean
    restore(): void
}

export const installFetch = (): FetchHarness => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "fetch")
    const calls: FetchCall[] = []
    const harness: FetchHarness = {
        calls,
        ignoreAbort: false,
        restore: () => {
            if (original === undefined)
                delete (globalThis as { fetch?: unknown }).fetch
            else Object.defineProperty(globalThis, "fetch", original)
        },
    }
    const fake = (input: unknown, init?: RequestInit): Promise<unknown> => {
        const url =
            typeof input === "string"
                ? input
                : String((input as { url?: unknown }).url ?? input)
        const signal = init?.signal ?? undefined
        let settled = false
        let resolve!: (value: unknown) => void
        let reject!: (error: unknown) => void
        const promise = new Promise((a, b) => {
            resolve = a
            reject = b
        })
        const call: FetchCall = {
            url,
            init,
            signal,
            respond: (body, status = 200) => {
                if (settled) return
                settled = true
                resolve({
                    ok: status >= 200 && status < 300,
                    status,
                    text: async () => body,
                })
            },
            fail: (error = new TypeError("Failed to fetch")) => {
                if (settled) return
                settled = true
                reject(error)
            },
            get settled() {
                return settled
            },
        }
        signal?.addEventListener("abort", () => {
            if (harness.ignoreAbort || settled) return
            settled = true
            reject(signal.reason)
        })
        calls.push(call)
        return promise
    }
    Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: fake,
    })
    return harness
}

/** Lets queued promise reactions and zero-delay timers run. */
export const flush = async (rounds = 3): Promise<void> => {
    for (let round = 0; round < rounds; round++)
        await new Promise(resolve => setTimeout(resolve, 0))
}

export interface ReportCapture {
    readonly reported: unknown[]
    readonly unhandled: unknown[]
    restore(): void
}

/** Captures `reportError` calls and unhandled rejections. */
export const captureReports = (): ReportCapture => {
    const reported: unknown[] = []
    const unhandled: unknown[] = []
    const own = Object.getOwnPropertyDescriptor(globalThis, "reportError")
    Object.defineProperty(globalThis, "reportError", {
        configurable: true,
        writable: true,
        value: (error: unknown) => {
            reported.push(error)
        },
    })
    const onUnhandled = (reason: unknown) => {
        unhandled.push(reason)
    }
    process.on("unhandledRejection", onUnhandled)
    return {
        reported,
        unhandled,
        restore: () => {
            process.off("unhandledRejection", onUnhandled)
            if (own === undefined)
                delete (globalThis as { reportError?: unknown }).reportError
            else Object.defineProperty(globalThis, "reportError", own)
        },
    }
}

export const V4 = "203.0.113.7"
export const V4_NEXT = "198.51.100.23"
export const V6 = "2001:db8::7"
