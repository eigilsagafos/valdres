import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import {
    installFetch,
    V4,
    V6,
    type FetchHarness,
} from "../../test/setup/fetchHarness"
import { publicIpAtom } from "../atoms/publicIpAtom"
import { fetchPublicIp } from "./fetchPublicIp"

let net: FetchHarness
beforeEach(() => {
    net = installFetch()
})
afterEach(() => net.restore())

describe("fetchPublicIp", () => {
    test("looks up an address without publishing or sharing", async () => {
        const app = store()
        let notified = 0
        app.sub(publicIpAtom, () => notified++)
        const first = fetchPublicIp({ family: "v6" })
        const second = fetchPublicIp({ family: "v6" })
        expect(net.calls.map(call => call.url)).toEqual([
            "https://api6.ipify.org",
            "https://api6.ipify.org",
        ])
        net.calls[0]!.respond(V6)
        net.calls[1]!.respond(V6)
        expect(await Promise.all([first, second])).toEqual([V6, V6])
        expect(notified).toBe(0)
        expect(app.get(publicIpAtom).status).toBe("idle")
        app.dispose()
    })

    test("validates the family and rejects with every endpoint's failure", async () => {
        const answer = fetchPublicIp({
            family: "v4",
            endpoints: ["https://ip.test/a"],
        })
        net.calls[0]!.respond(V6)
        const error = (await answer.catch(failure => failure)) as AggregateError
        expect(error.errors.map(cause => (cause as Error).message)).toEqual([
            "https://ip.test/a did not return an IPv4 address",
        ])
    })

    test("a signal aborts the lookup and later endpoints are never asked", async () => {
        const controller = new AbortController()
        const answer = fetchPublicIp({
            endpoints: ["https://ip.test/a", "https://ip.test/b"],
            signal: controller.signal,
        })
        controller.abort()
        expect(
            ((await answer.catch((failure: unknown) => failure)) as Error).name,
        ).toBe("AbortError")
        expect(net.calls).toHaveLength(1)
        expect(net.calls[0]!.signal?.aborted).toBe(true)
    })

    test("throws TypeError for invalid options and requests nothing", () => {
        expect(() => fetchPublicIp({ endpoints: [] })).toThrow(TypeError)
        expect(net.calls).toEqual([])
    })

    test("a body longer than any address is rejected without validation", async () => {
        const answer = fetchPublicIp({ endpoints: ["https://ip.test/a"] })
        net.calls[0]!.respond(`${V4}${" x".repeat(40)}`)
        await expect(answer).rejects.toBeInstanceOf(AggregateError)
    })
})
