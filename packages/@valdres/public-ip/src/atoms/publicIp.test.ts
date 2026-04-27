import { describe, test, expect, afterEach, afterAll } from "bun:test"
import { store, type GlobalAtom } from "valdres"
import { publicIpAtom } from "./publicIpAtom"
import { publicIpV4Atom } from "./publicIpV4Atom"
import { publicIpV6Atom } from "./publicIpV6Atom"
import { publicIpEndpointsAtom } from "./publicIpEndpointsAtom"
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

const v4Ip = "203.0.113.1"
const v6Ip = "2001:db8::1"

const cases = [
    {
        label: "publicIpAtom",
        ipAtom: publicIpAtom,
        endpointsAtom: publicIpEndpointsAtom,
        defaultEndpoint: "https://api.ipify.org",
        ip: v4Ip,
        customIp: "198.51.100.1",
    },
    {
        label: "publicIpV4Atom",
        ipAtom: publicIpV4Atom,
        endpointsAtom: publicIpV4EndpointsAtom,
        defaultEndpoint: "https://api4.ipify.org",
        ip: v4Ip,
        customIp: "198.51.100.1",
    },
    {
        label: "publicIpV6Atom",
        ipAtom: publicIpV6Atom,
        endpointsAtom: publicIpV6EndpointsAtom,
        defaultEndpoint: "https://api6.ipify.org",
        ip: v6Ip,
        customIp: "2001:db8::2",
    },
] as const

const m = mockFetch()

afterAll(() => {
    m.restore()
})

for (const { label, ipAtom, endpointsAtom, defaultEndpoint, ip, customIp } of cases) {
    describe(label, () => {
        let activeUnsubs: Array<() => void> = []

        afterEach(() => {
            for (const unsub of activeUnsubs) unsub()
            activeUnsubs = []
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
            activeUnsubs.push(s.sub(ipAtom, () => {}))
            const before = m.calls.length
            await waitUntil(() => m.calls.length > before)
            expect(await s.get(ipAtom)).toBe(ip)
        })
    })
}

describe("family validation", () => {
    afterEach(() => {
        m.reset()
        publicIpV4Atom.resetSelf()
        publicIpV6Atom.resetSelf()
        publicIpAtom.resetSelf()
        publicIpV4EndpointsAtom.resetSelf()
        publicIpV6EndpointsAtom.resetSelf()
        publicIpEndpointsAtom.resetSelf()
    })

    test("publicIpV4Atom falls through an IPv6 body", async () => {
        publicIpV4EndpointsAtom.setSelf([
            "https://wrong-family.example",
            "https://correct.example",
        ])
        m.alwaysRespond("https://wrong-family.example", v6Ip)
        m.alwaysRespond("https://correct.example", v4Ip)
        const s = store()
        expect(await s.get(publicIpV4Atom)).toBe(v4Ip)
        expect(m.calls).toContain("https://wrong-family.example")
        expect(m.calls).toContain("https://correct.example")
    })

    test("publicIpV6Atom falls through an IPv4 body", async () => {
        publicIpV6EndpointsAtom.setSelf([
            "https://wrong-family.example",
            "https://correct.example",
        ])
        m.alwaysRespond("https://wrong-family.example", v4Ip)
        m.alwaysRespond("https://correct.example", v6Ip)
        const s = store()
        expect(await s.get(publicIpV6Atom)).toBe(v6Ip)
    })

    test("publicIpAtom accepts either family", async () => {
        publicIpEndpointsAtom.setSelf(["https://any.example"])
        m.alwaysRespond("https://any.example", v6Ip)
        const s = store()
        expect(await s.get(publicIpAtom)).toBe(v6Ip)
    })
})
