import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { atom, store, type Store } from "valdres"
import {
    captureReports,
    flush,
    installFetch,
    V4,
    V4_NEXT,
    V6,
    type FetchHarness,
    type ReportCapture,
} from "../../test/setup/fetchHarness"
import { publicIpAtom } from "../atoms/publicIpAtom"
import { publicIpV4Atom } from "../atoms/publicIpV4Atom"
import { publicIpV6Atom } from "../atoms/publicIpV6Atom"
import {
    forgetPublicIp,
    inspectPublicIp,
    usePublicIpLookup,
} from "../lib/publicIpRecord"
import { publicIpErrorAtom } from "../selectors/publicIpErrorAtom"
import { publicIpStatusAtom } from "../selectors/publicIpStatusAtom"
import { publicIpValueAtom } from "../selectors/publicIpValueAtom"
import { requestPublicIp } from "./requestPublicIp"

let net: FetchHarness
let reports: ReportCapture
const stores: Store[] = []
const app = () => {
    const created = store()
    stores.push(created)
    return created
}

beforeEach(() => {
    net = installFetch()
    reports = captureReports()
})
afterEach(async () => {
    for (const created of stores.splice(0)) created.dispose()
    forgetPublicIp()
    await flush()
    net.restore()
    reports.restore()
})

/** Every status a store's subscriber saw, in order. */
const watch = (target: Store, state = publicIpAtom) => {
    const seen: string[] = []
    const stop = target.sub(state, () => {
        const value = target.get(state)
        seen.push(`${value.status}:${value.ip ?? "-"}`)
    })
    return { seen, stop }
}

describe("explicit requests", () => {
    test("reading and subscribing request nothing", () => {
        const root = app()
        expect(root.get(publicIpAtom)).toEqual({
            status: "idle",
            ip: null,
            updatedAt: null,
            error: null,
        })
        const stops = [
            root.sub(publicIpAtom, () => {}),
            root.sub(publicIpValueAtom, () => {}),
            root.scope().sub(publicIpV4Atom, () => {}),
            app().sub(publicIpV6Atom, () => {}),
        ]
        expect(net.calls).toEqual([])
        for (const stop of stops) stop()
        expect(net.calls).toEqual([])
    })

    test("a request fetches synchronously, publishes pending, then the address", async () => {
        const root = app()
        const { seen } = watch(root)
        const before = Date.now()
        const answer = requestPublicIp()
        expect(net.calls.map(call => call.url)).toEqual([
            "https://api.ipify.org",
        ])
        expect(root.get(publicIpStatusAtom)).toBe("pending")
        net.calls[0]!.respond(`${V4}\n`)
        expect(await answer).toBe(V4)
        const state = root.get(publicIpAtom)
        expect(state).toMatchObject({ status: "ready", ip: V4, error: null })
        expect(state.updatedAt).toBeGreaterThanOrEqual(before)
        expect(Object.isFrozen(state)).toBe(true)
        expect(seen).toEqual(["pending:-", `ready:${V4}`])
    })

    test("requests send no credentials or referrer and bypass the HTTP cache", () => {
        void requestPublicIp().catch(() => {})
        expect(net.calls[0]!.init).toMatchObject({
            cache: "no-store",
            credentials: "omit",
            referrerPolicy: "no-referrer",
        })
    })

    test("a refresh keeps the previous address while pending, then replaces it", async () => {
        const root = app()
        const first = requestPublicIp()
        net.calls[0]!.respond(V4)
        await first
        const { seen } = watch(root)
        const second = requestPublicIp()
        expect(root.get(publicIpAtom)).toMatchObject({
            status: "pending",
            ip: V4,
        })
        net.calls[1]!.respond(V4_NEXT)
        expect(await second).toBe(V4_NEXT)
        expect(seen).toEqual([`pending:${V4}`, `ready:${V4_NEXT}`])
    })

    test("custom endpoints are tried in order and the family's own state changes", async () => {
        const root = app()
        const answer = requestPublicIp({
            family: "v6",
            endpoints: ["https://ip.test/a", "https://ip.test/b"],
        })
        expect(root.get(publicIpV6Atom).status).toBe("pending")
        expect(root.get(publicIpAtom).status).toBe("idle")
        expect(root.get(publicIpV4Atom).status).toBe("idle")
        net.calls[0]!.respond("", 503)
        await flush()
        expect(net.calls.map(call => call.url)).toEqual([
            "https://ip.test/a",
            "https://ip.test/b",
        ])
        net.calls[1]!.respond(V6)
        expect(await answer).toBe(V6)
        expect(root.get(publicIpV6Atom).ip).toBe(V6)
        expect(root.get(publicIpAtom).status).toBe("idle")
    })

    test("invalid options throw before anything is requested", () => {
        for (const options of [
            { family: "v5" },
            { endpoints: [] },
            { endpoints: "https://ip.test" },
            { endpoints: [""] },
            { timeoutMs: 0 },
            { timeoutMs: Number.NaN },
        ])
            expect(() => requestPublicIp(options as never)).toThrow(TypeError)
        expect(net.calls).toEqual([])
        expect(app().get(publicIpStatusAtom)).toBe("idle")
    })
})

describe("failures", () => {
    test("rejected requests, error statuses and non-address bodies fall through to the next endpoint", async () => {
        const answer = requestPublicIp({
            family: "v4",
            endpoints: [
                "https://ip.test/down",
                "https://ip.test/500",
                "https://ip.test/html",
                "https://ip.test/v6",
                "https://ip.test/ok",
            ],
        })
        net.calls[0]!.fail(new TypeError("Failed to fetch"))
        await flush()
        net.calls[1]!.respond("oops", 500)
        await flush()
        net.calls[2]!.respond("<html>203.0.113.7</html>")
        await flush()
        net.calls[3]!.respond(V6)
        await flush()
        net.calls[4]!.respond(` ${V4} `)
        expect(await answer).toBe(V4)
    })

    test("when every endpoint fails, the promise rejects and the state reports why", async () => {
        const root = app()
        const answer = requestPublicIp({
            endpoints: ["https://ip.test/a", "https://ip.test/b"],
        })
        net.calls[0]!.respond("", 502)
        await flush()
        net.calls[1]!.respond("not an address")
        const error = await answer.catch(failure => failure)
        expect(error).toBeInstanceOf(AggregateError)
        expect(
            (error as AggregateError).errors.map(
                cause => (cause as Error).message,
            ),
        ).toEqual([
            "https://ip.test/a responded 502",
            "https://ip.test/b did not return an IP address",
        ])
        expect(root.get(publicIpAtom)).toEqual({
            status: "error",
            ip: null,
            updatedAt: null,
            error: {
                name: "AggregateError",
                message:
                    "Every public IP endpoint failed: https://ip.test/a responded 502; https://ip.test/b did not return an IP address",
            },
        })
        expect(root.get(publicIpErrorAtom)?.name).toBe("AggregateError")
    })

    test("a failed refresh keeps the last address next to the error", async () => {
        const root = app()
        const first = requestPublicIp({ endpoints: ["https://ip.test/a"] })
        net.calls[0]!.respond(V4)
        await first
        const { updatedAt } = root.get(publicIpAtom)
        const second = requestPublicIp({ endpoints: ["https://ip.test/a"] })
        net.calls[1]!.fail()
        await expect(second).rejects.toBeInstanceOf(AggregateError)
        expect(root.get(publicIpAtom)).toMatchObject({
            status: "error",
            ip: V4,
            updatedAt,
        })
        expect(root.get(publicIpValueAtom)).toBe(V4)
    })

    test("a slow endpoint times out and the next one is asked", async () => {
        const answer = requestPublicIp({
            endpoints: ["https://ip.test/slow", "https://ip.test/ok"],
            timeoutMs: 15,
        })
        while (net.calls.length < 2)
            await new Promise(resolve => setTimeout(resolve, 1))
        expect(net.calls[0]!.signal?.aborted).toBe(true)
        expect((net.calls[0]!.signal?.reason as Error).name).toBe(
            "TimeoutError",
        )
        net.calls[1]!.respond(V4)
        expect(await answer).toBe(V4)
    })

    test("a failure is never retried automatically; the next explicit call is", async () => {
        const root = app()
        const failed = requestPublicIp({ endpoints: ["https://ip.test/a"] })
        net.calls[0]!.fail()
        await failed.catch(() => {})
        await flush()
        expect(net.calls).toHaveLength(1)
        const retry = requestPublicIp({ endpoints: ["https://ip.test/a"] })
        expect(root.get(publicIpAtom)).toMatchObject({
            status: "pending",
            error: null,
        })
        net.calls[1]!.respond(V4)
        expect(await retry).toBe(V4)
        expect(root.get(publicIpAtom)).toMatchObject({
            status: "ready",
            ip: V4,
            error: null,
        })
    })

    test("without fetch the state is unsupported and requests reject", async () => {
        const root = app()
        const fetchDescriptor = Object.getOwnPropertyDescriptor(
            globalThis,
            "fetch",
        )!
        delete (globalThis as { fetch?: unknown }).fetch
        try {
            expect(root.get(publicIpAtom).status).toBe("unsupported")
            const error = await requestPublicIp().catch(failure => failure)
            expect((error as Error).name).toBe("NotSupportedError")
        } finally {
            Object.defineProperty(globalThis, "fetch", fetchDescriptor)
        }
        expect(root.get(publicIpAtom).status).toBe("idle")
    })
})

describe("concurrency", () => {
    test("concurrent calls share one request; a joining call's options are ignored", async () => {
        const first = requestPublicIp()
        const second = requestPublicIp({ endpoints: ["https://ip.test/other"] })
        expect(net.calls).toHaveLength(1)
        net.calls[0]!.respond(V4)
        expect(await Promise.all([first, second])).toEqual([V4, V4])
    })

    test("fresh replaces the in-flight request; the replaced callers reject with AbortError", async () => {
        const root = app()
        const old = requestPublicIp()
        const replacement = requestPublicIp({ fresh: true })
        expect(net.calls).toHaveLength(2)
        expect(net.calls[0]!.signal?.aborted).toBe(true)
        const error = await old.catch(failure => failure)
        expect((error as Error).name).toBe("AbortError")
        expect(root.get(publicIpStatusAtom)).toBe("pending")
        net.calls[1]!.respond(V4)
        expect(await replacement).toBe(V4)
    })

    test("out of order: a replaced request's late response cannot overwrite the newer one", async () => {
        net.ignoreAbort = true
        const root = app()
        const { seen } = watch(root)
        const old = requestPublicIp()
        const newer = requestPublicIp({ fresh: true })
        net.calls[1]!.respond(V4_NEXT)
        expect(await newer).toBe(V4_NEXT)
        // The old response was already completing when the abort arrived.
        net.calls[0]!.respond(V4)
        expect(await old.catch(failure => (failure as Error).name)).toBe(
            "AbortError",
        )
        await flush()
        expect(root.get(publicIpValueAtom)).toBe(V4_NEXT)
        expect(seen).toEqual(["pending:-", `ready:${V4_NEXT}`])
    })

    test("out of order: a replaced request's late failure cannot mark the newer result as failed", async () => {
        net.ignoreAbort = true
        const root = app()
        const old = requestPublicIp({ endpoints: ["https://ip.test/a"] })
        const newer = requestPublicIp({
            endpoints: ["https://ip.test/a"],
            fresh: true,
        })
        net.calls[1]!.respond(V4)
        await newer
        net.calls[0]!.fail()
        await old.catch(() => {})
        await flush()
        expect(root.get(publicIpAtom)).toMatchObject({
            status: "ready",
            ip: V4,
            error: null,
        })
    })
})

describe("stale-result guard", () => {
    // A lookup that resolves despite its abort: the answer was already on its
    // way when the run was replaced or cancelled. Only the record's ownership
    // check stands between it and the store.
    const lateLookup = () => {
        const answers: ((ip: string) => void)[] = []
        usePublicIpLookup(
            () => new Promise<string>(resolve => answers.push(resolve)),
        )
        return answers
    }
    afterEach(() => usePublicIpLookup())

    test("a replaced lookup that still resolves publishes nothing", async () => {
        const answers = lateLookup()
        const root = app()
        const old = requestPublicIp()
        const newer = requestPublicIp({ fresh: true })
        answers[1]!(V4_NEXT)
        expect(await newer).toBe(V4_NEXT)
        answers[0]!(V4)
        // Its own callers still get what the lookup answered.
        expect(await old).toBe(V4)
        await flush()
        expect(root.get(publicIpValueAtom)).toBe(V4_NEXT)
    })

    test("a cancelled lookup that still resolves publishes nothing", async () => {
        const answers = lateLookup()
        const root = app()
        const { seen } = watch(root)
        const controller = new AbortController()
        const answer = requestPublicIp({ signal: controller.signal })
        controller.abort()
        await answer.catch(() => {})
        answers[0]!(V4)
        await flush()
        expect(root.get(publicIpAtom).status).toBe("idle")
        expect(seen).toEqual(["pending:-", "idle:-"])
    })
})

describe("cancellation", () => {
    test("a pre-aborted signal rejects without requesting or publishing", async () => {
        const root = app()
        const { seen } = watch(root)
        const reason = new Error("never mind")
        await expect(
            requestPublicIp({ signal: AbortSignal.abort(reason) }),
        ).rejects.toBe(reason)
        expect(net.calls).toEqual([])
        expect(seen).toEqual([])
    })

    test("the only caller cancelling aborts the request and restores the previous state", async () => {
        const root = app()
        const first = requestPublicIp()
        net.calls[0]!.respond(V4)
        await first
        const before = root.get(publicIpAtom)
        const { seen } = watch(root)
        const controller = new AbortController()
        const answer = requestPublicIp({ signal: controller.signal })
        controller.abort()
        expect(
            ((await answer.catch((failure: unknown) => failure)) as Error).name,
        ).toBe("AbortError")
        expect(net.calls[1]!.signal?.aborted).toBe(true)
        expect(root.get(publicIpAtom)).toBe(before)
        expect(seen).toEqual([`pending:${V4}`, `ready:${V4}`])
        expect(inspectPublicIp("any").inFlight).toBe(false)
    })

    test("one caller cancelling leaves the shared request running for the others", async () => {
        const controller = new AbortController()
        const cancelled = requestPublicIp({ signal: controller.signal })
        const kept = requestPublicIp({ signal: new AbortController().signal })
        controller.abort()
        await expect(cancelled).rejects.toBeDefined()
        expect(net.calls[0]!.signal?.aborted).toBe(false)
        net.calls[0]!.respond(V4)
        expect(await kept).toBe(V4)
    })

    test("a caller without a signal keeps the request alive when the others cancel", async () => {
        const controller = new AbortController()
        const pinned = requestPublicIp()
        const cancelled = requestPublicIp({ signal: controller.signal })
        controller.abort()
        await cancelled.catch(() => {})
        expect(net.calls[0]!.signal?.aborted).toBe(false)
        net.calls[0]!.respond(V4)
        expect(await pinned).toBe(V4)
    })

    test("a response that completes after cancellation publishes nothing", async () => {
        net.ignoreAbort = true
        const root = app()
        const { seen } = watch(root)
        const controller = new AbortController()
        const answer = requestPublicIp({ signal: controller.signal })
        controller.abort()
        await answer.catch(() => {})
        net.calls[0]!.respond(V4)
        await flush()
        expect(root.get(publicIpAtom).status).toBe("idle")
        expect(seen).toEqual(["pending:-", "idle:-"])
    })

    test("a request after a cancellation starts afresh", async () => {
        const controller = new AbortController()
        const cancelled = requestPublicIp({ signal: controller.signal })
        controller.abort()
        await cancelled.catch(() => {})
        const next = requestPublicIp()
        expect(net.calls).toHaveLength(2)
        net.calls[1]!.respond(V4)
        expect(await next).toBe(V4)
    })
})

describe("stores", () => {
    test("root, child scope and an independent store all observe the same result", async () => {
        const root = app()
        const child = root.scope()
        const other = app()
        const seen = [watch(root), watch(child), watch(other)]
        const answer = requestPublicIp()
        net.calls[0]!.respond(V4)
        await answer
        for (const { seen: statuses } of seen)
            expect(statuses).toEqual(["pending:-", `ready:${V4}`])
        expect(
            [root, child, other].map(target => target.get(publicIpValueAtom)),
        ).toEqual([V4, V4, V4])
        // A store created afterwards reads the result without requesting.
        expect(app().get(publicIpValueAtom)).toBe(V4)
        expect(net.calls).toHaveLength(1)
    })

    test("each store tree registers once and releases on unsubscribe and dispose", () => {
        const root = app()
        const stopRoot = root.sub(publicIpAtom, () => {})
        const stopChild = root.scope().sub(publicIpValueAtom, () => {})
        expect(inspectPublicIp("any").registrations).toBe(1)
        const other = app()
        other.sub(publicIpStatusAtom, () => {})
        expect(inspectPublicIp("any").registrations).toBe(2)
        stopRoot()
        expect(inspectPublicIp("any").registrations).toBe(2)
        stopChild()
        expect(inspectPublicIp("any").registrations).toBe(1)
        other.dispose()
        expect(inspectPublicIp("any").registrations).toBe(0)
    })

    test("a store disposed while a request is pending receives nothing; the others do", async () => {
        const doomed = app()
        const kept = app()
        let doomedCalls = 0
        doomed.sub(publicIpAtom, () => doomedCalls++)
        const { seen } = watch(kept)
        const answer = requestPublicIp()
        doomedCalls = 0
        doomed.dispose()
        net.calls[0]!.respond(V4)
        expect(await answer).toBe(V4)
        expect(doomedCalls).toBe(0)
        expect(seen).toEqual(["pending:-", `ready:${V4}`])
        expect(reports.reported).toEqual([])
        expect(() => doomed.get(publicIpAtom)).toThrow()
    })

    test("unsubscribing does not cancel the request; the result is there on return", async () => {
        const root = app()
        const stop = root.sub(publicIpAtom, () => {})
        const answer = requestPublicIp()
        stop()
        expect(net.calls[0]!.signal?.aborted).toBe(false)
        net.calls[0]!.respond(V4)
        await answer
        expect(root.get(publicIpValueAtom)).toBe(V4)
    })
})

describe("subscriber failures", () => {
    test("a throwing subscriber never changes the promise and never starves another store", async () => {
        const noisy = app()
        const quiet = app()
        noisy.sub(publicIpAtom, () => {
            throw new Error("subscriber bug")
        })
        const { seen } = watch(quiet)
        const answer = requestPublicIp()
        net.calls[0]!.respond(V4)
        expect(await answer).toBe(V4)
        await flush()
        expect(seen).toEqual(["pending:-", `ready:${V4}`])
        expect(reports.reported).toHaveLength(2)
        expect(
            reports.reported.every(
                error =>
                    (error as Error).name === "SubscriberNotificationError",
            ),
        ).toBe(true)
        expect(reports.unhandled).toEqual([])
        // Reported once per publication; never retried.
        expect(net.calls).toHaveLength(1)
    })

    test("a network failure stays the promise's outcome when a subscriber throws", async () => {
        const noisy = app()
        noisy.sub(publicIpAtom, () => {
            throw new Error("subscriber bug")
        })
        const answer = requestPublicIp({ endpoints: ["https://ip.test/a"] })
        net.calls[0]!.fail()
        await expect(answer).rejects.toBeInstanceOf(AggregateError)
        await flush()
        expect(noisy.get(publicIpStatusAtom)).toBe("error")
        expect(reports.unhandled).toEqual([])
    })

    test("a request made inside a transaction is published once the transaction is over", async () => {
        const root = app()
        const trigger = atom(0)
        const { seen } = watch(root)
        let answer: Promise<string> | undefined
        root.txn(tx => {
            tx.set(trigger, 1)
            answer = requestPublicIp()
        })
        await flush(1)
        expect(root.get(publicIpStatusAtom)).toBe("pending")
        expect(seen).toEqual(["pending:-"])
        net.calls[0]!.respond(V4)
        expect(await answer!).toBe(V4)
        expect(reports.reported).toEqual([])
    })

    test("a request made from a subscriber callback publishes immediately", async () => {
        const root = app()
        const trigger = atom(0)
        let answer: Promise<string> | undefined
        root.sub(trigger, () => {
            answer = requestPublicIp()
        })
        const { seen } = watch(root)
        root.set(trigger, 1)
        expect(seen).toEqual(["pending:-"])
        net.calls[0]!.respond(V4)
        expect(await answer!).toBe(V4)
        expect(reports.reported).toEqual([])
    })
})
