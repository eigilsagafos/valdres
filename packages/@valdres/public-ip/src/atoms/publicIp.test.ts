import { describe, test, expect, afterEach } from "bun:test"
import { store, type GlobalAtom } from "valdres"
import { publicIpV4Atom } from "./publicIpV4Atom"
import { publicIpV6Atom } from "./publicIpV6Atom"
import { publicIpV4EndpointsAtom } from "./publicIpV4EndpointsAtom"
import { publicIpV6EndpointsAtom } from "./publicIpV6EndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"
import { mockFetch } from "../../test/mockFetch"

const waitUntil = async (predicate: () => boolean, timeoutMs = 500) => {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs)
            throw new Error("waitUntil timed out")
        await new Promise(r => setTimeout(r, 5))
    }
}

const cases = [
    {
        label: "publicIpV4Atom",
        ipAtom: publicIpV4Atom,
        endpointsAtom: publicIpV4EndpointsAtom,
        defaultEndpoint: "https://api.ipify.org",
        ip: "203.0.113.1",
        customIp: "198.51.100.1",
    },
    {
        label: "publicIpV6Atom",
        ipAtom: publicIpV6Atom,
        endpointsAtom: publicIpV6EndpointsAtom,
        defaultEndpoint: "https://api6.ipify.org",
        ip: "2001:db8::1",
        customIp: "2001:db8::2",
    },
] as const

const m = mockFetch()

for (const { label, ipAtom, endpointsAtom, defaultEndpoint, ip, customIp } of cases) {
    describe(label, () => {
        afterEach(() => {
            m.reset()
            ;(ipAtom as GlobalAtom<any>).resetSelf()
            endpointsAtom.resetSelf()
            publicIpMaxAgeAtom.resetSelf()
        })

        test("fetches on first read", async () => {
            m.alwaysRespond(defaultEndpoint, ip)
            const s = store()
            expect(await s.get(ipAtom)).toBe(ip)
        })

        test("uses custom endpoints", async () => {
            endpointsAtom.setSelf(["https://custom.example"])
            m.alwaysRespond("https://custom.example", customIp)
            const s = store()
            expect(await s.get(ipAtom)).toBe(customIp)
            expect(m.calls.every(c => c === "https://custom.example")).toBe(true)
        })

        test("revalidates after maxAge elapses", async () => {
            publicIpMaxAgeAtom.setSelf(30)
            m.alwaysRespond(defaultEndpoint, ip)
            const s = store()
            s.sub(ipAtom, () => {})
            const before = m.calls.length
            await waitUntil(() => m.calls.length > before)
            expect(await s.get(ipAtom)).toBe(ip)
        })
    })
}
