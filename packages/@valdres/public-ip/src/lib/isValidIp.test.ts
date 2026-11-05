import { describe, expect, test } from "bun:test"
import { isValidIp } from "./isValidIp"
import { isValidIpV4 } from "./isValidIpV4"
import { isValidIpV6 } from "./isValidIpV6"

describe("address validation", () => {
    test("IPv4", () => {
        for (const ok of ["203.0.113.7", "0.0.0.0", "255.255.255.255"])
            expect(isValidIpV4(ok)).toBe(true)
        for (const bad of [
            "256.0.0.1",
            "203.0.113",
            "203.0.113.7.1",
            "2001:db8::1",
            "",
            "a.b.c.d",
        ])
            expect(isValidIpV4(bad)).toBe(false)
    })

    test("IPv6", () => {
        for (const ok of [
            "2001:db8::7",
            "::1",
            "2001:0db8:0000:0000:0000:ff00:0042:8329",
            "fe80::",
        ])
            expect(isValidIpV6(ok)).toBe(true)
        for (const bad of ["203.0.113.7", "2001:db8:::1", "2001:db8::g", ""])
            expect(isValidIpV6(bad)).toBe(false)
    })

    test("either family", () => {
        expect(isValidIp("203.0.113.7")).toBe(true)
        expect(isValidIp("2001:db8::7")).toBe(true)
        expect(isValidIp("<html>")).toBe(false)
    })
})
