import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import type { DeviceHarness } from "../../test/setup/deviceHarness"
import { installMotion, motionEvent } from "../../test/setup/motionFixtures"
import { motionSource } from "../lib/motionSource"
import { accelerationSelector } from "./accelerationSelector"
import { motionAtom } from "./motionAtom"
import { motionStatusAtom } from "./motionStatusAtom"

let harness: DeviceHarness | undefined
const install = () => (harness = installMotion())
afterEach(() => {
    harness?.restore()
    harness = undefined
})

describe("motionAtom", () => {
    test("a dormant read reports idle and attaches nothing", () => {
        const page = install()
        const app = store()
        expect(app.get(motionAtom)).toBeNull()
        expect(app.get(motionStatusAtom)).toBe("idle")
        expect(page.listeners("devicemotion")).toBe(0)
        app.dispose()
    })

    test("subscribing attaches one listener and publishes readings with their status", () => {
        const page = install()
        const app = store()
        const seen: unknown[] = []
        const stop = app.sub(motionAtom, () => {
            seen.push([app.get(motionStatusAtom), app.get(motionAtom)?.acceleration?.x])
        })
        expect(page.listeners("devicemotion")).toBe(1)
        expect(app.get(motionStatusAtom)).toBe("active")
        expect(app.get(motionAtom)).toBeNull()

        page.fire(motionEvent(0.5))
        page.fire(motionEvent(0.7))
        expect(seen).toEqual([
            ["active", 0.5],
            ["active", 0.7],
        ])
        expect(app.get(accelerationSelector)).toEqual({ x: 0.7, y: 0, z: 0 })

        stop()
        expect(page.listeners("devicemotion")).toBe(0)
        app.dispose()
    })

    test("the last release discards the reading so a later attach never reports stale data", () => {
        const page = install()
        const app = store()
        app.sub(motionAtom, () => {})
        page.fire(motionEvent(1))
        expect(app.get(motionAtom)?.acceleration?.x).toBe(1)
        app.dispose()

        const next = store()
        expect(next.get(motionAtom)).toBeNull()
        expect(next.get(motionStatusAtom)).toBe("idle")
        const stop = next.sub(motionAtom, () => {})
        expect(next.get(motionAtom)).toBeNull()
        stop()
        next.dispose()
    })

    test("independent stores share one window listener and both receive readings", () => {
        const page = install()
        const first = store()
        const second = store()
        const seen: string[] = []
        const stopFirst = first.sub(motionAtom, () => seen.push("first"))
        const stopSecond = second.sub(motionAtom, () => seen.push("second"))
        expect(page.listeners("devicemotion")).toBe(1)

        page.fire(motionEvent(2))
        expect(seen).toEqual(["first", "second"])

        stopFirst()
        expect(page.listeners("devicemotion")).toBe(1)
        page.fire(motionEvent(3))
        expect(second.get(motionAtom)?.acceleration?.x).toBe(3)

        stopSecond()
        expect(page.listeners("devicemotion")).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a child scope shares its root's registration", () => {
        const page = install()
        const app = store()
        const child = app.scope()
        const stopRoot = app.sub(motionAtom, () => {})
        const stopChild = child.sub(motionStatusAtom, () => {})
        expect(page.listeners("devicemotion")).toBe(1)
        page.fire(motionEvent(4))
        expect(child.get(motionAtom)?.acceleration?.x).toBe(4)
        stopRoot()
        expect(page.listeners("devicemotion")).toBe(1)
        stopChild()
        expect(page.listeners("devicemotion")).toBe(0)
        child.dispose()
        app.dispose()
    })

    test("disposing a store with live subscribers releases its registration", () => {
        const page = install()
        const app = store()
        app.sub(motionAtom, () => {})
        app.scope().sub(motionAtom, () => {})
        expect(page.listeners("devicemotion")).toBe(1)
        app.dispose()
        expect(page.listeners("devicemotion")).toBe(0)
    })

    test("one throwing subscriber does not starve another store", () => {
        const page = install()
        const failing = store()
        const healthy = store()
        let healthyRuns = 0
        failing.sub(motionAtom, () => {
            throw new Error("subscriber exploded")
        })
        healthy.sub(motionAtom, () => healthyRuns++)

        const reported = page.fireReportingErrors(motionEvent(5))
        expect(healthyRuns).toBe(1)
        expect(healthy.get(motionAtom)?.acceleration?.x).toBe(5)
        expect(failing.get(motionAtom)?.acceleration?.x).toBe(5)
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")

        failing.dispose()
        healthy.dispose()
        expect(page.listeners("devicemotion")).toBe(0)
    })

    test("several failing stores are reported together after all ran", () => {
        const page = install()
        const stores = [store(), store(), store()]
        let healthyRuns = 0
        stores[0]!.sub(motionAtom, () => {
            throw new Error("a")
        })
        stores[1]!.sub(motionAtom, () => {
            throw new Error("b")
        })
        stores[2]!.sub(motionAtom, () => healthyRuns++)
        const reported = page.fireReportingErrors(motionEvent(6))
        expect(healthyRuns).toBe(1)
        expect(reported).toHaveLength(1)
        expect(reported[0]).toBeInstanceOf(AggregateError)
        expect((reported[0] as AggregateError).errors).toHaveLength(2)
        for (const app of stores) app.dispose()
    })

    test("missing DeviceMotionEvent reports unsupported and attaches nothing", () => {
        const page = install()
        page.setGlobal("DeviceMotionEvent", undefined)
        const app = store()
        const stop = app.sub(motionAtom, () => {})
        expect(app.get(motionStatusAtom)).toBe("unsupported")
        expect(page.listeners("devicemotion")).toBe(0)
        stop()
        app.dispose()
    })

    test("an insecure context reports insecure and attaches nothing", () => {
        const page = install()
        page.setSecure(false)
        const app = store()
        const stop = app.sub(motionAtom, () => {})
        expect(app.get(motionStatusAtom)).toBe("insecure")
        expect(app.get(motionAtom)).toBeNull()
        expect(page.listeners("devicemotion")).toBe(0)
        stop()
        app.dispose()
    })

    test("the server snapshot is a fixed idle seed", () => {
        install()
        expect(motionSource.getServerSnapshot?.()).toEqual({
            status: "idle",
            motion: null,
        })
    })

    test("the selectors are read-only", () => {
        install()
        const app = store()
        const loose = app as unknown as Record<"set" | "reset", (...args: unknown[]) => void>
        expect(() => loose.set(motionAtom, null)).toThrow(TypeError)
        expect(() => loose.reset(motionStatusAtom)).toThrow(TypeError)
        app.dispose()
    })
})
