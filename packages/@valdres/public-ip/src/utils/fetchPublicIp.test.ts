import { describe, test, expect, afterEach } from "bun:test"
import { fetchPublicIp } from "./fetchPublicIp"
import { mockFetch } from "../../test/mockFetch"

describe("fetchPublicIp", () => {
    const m = mockFetch()
    afterEach(m.reset)

    test("returns the IP from the first successful endpoint", async () => {
        m.queue(m.ok("203.0.113.5"))
        const ip = await fetchPublicIp(["https://api.ipify.org"])
        expect(ip).toBe("203.0.113.5")
    })

    test("falls through to the next endpoint on non-2xx", async () => {
        m.queue(m.fail(500))
        m.queue(m.ok("198.51.100.7"))
        const ip = await fetchPublicIp([
            "https://one.example",
            "https://two.example",
        ])
        expect(ip).toBe("198.51.100.7")
        expect(m.calls).toEqual(["https://one.example", "https://two.example"])
    })

    test("falls through when the body is not a valid IP", async () => {
        m.queue(m.ok("<!doctype html><html>oops</html>"))
        m.queue(m.ok("203.0.113.9"))
        const ip = await fetchPublicIp([
            "https://garbage.example",
            "https://good.example",
        ])
        expect(ip).toBe("203.0.113.9")
    })

    test("trims whitespace from the response", async () => {
        m.queue(m.ok("  203.0.113.9\n"))
        const ip = await fetchPublicIp(["https://trim.example"])
        expect(ip).toBe("203.0.113.9")
    })

    test("throws an AggregateError when every endpoint fails", async () => {
        m.queue(m.fail(500))
        m.queue(new Error("network down"))
        expect(
            fetchPublicIp(["https://a.example", "https://b.example"]),
        ).rejects.toBeInstanceOf(AggregateError)
    })

    test("accepts IPv6 addresses", async () => {
        m.queue(m.ok("2001:db8::1"))
        const ip = await fetchPublicIp(["https://v6.example"])
        expect(ip).toBe("2001:db8::1")
    })
})
