type FetchResponse = {
    ok: boolean
    status: number
    body: string
}

const ok = (body: string): FetchResponse => ({ ok: true, status: 200, body })
const fail = (status: number): FetchResponse => ({ ok: false, status, body: "" })

export const mockFetch = () => {
    const queued: Array<FetchResponse | Error> = []
    const persistent = new Map<string, FetchResponse>()
    const calls: string[] = []
    const original = globalThis.fetch

    globalThis.fetch = (async (input: any) => {
        const url = typeof input === "string" ? input : input.url
        calls.push(url)
        const next = queued.shift() ?? persistent.get(url)
        if (next === undefined)
            throw new Error(`mockFetch: no response queued for ${url}`)
        if (next instanceof Error) throw next
        return {
            ok: next.ok,
            status: next.status,
            text: async () => next.body,
        }
    }) as typeof fetch

    return {
        calls,
        queue: (response: FetchResponse | Error) => {
            queued.push(response)
        },
        alwaysRespond: (url: string, body: string) => {
            persistent.set(url, ok(body))
        },
        reset: () => {
            queued.length = 0
            persistent.clear()
            calls.length = 0
        },
        restore: () => {
            globalThis.fetch = original
        },
        ok,
        fail,
    }
}
