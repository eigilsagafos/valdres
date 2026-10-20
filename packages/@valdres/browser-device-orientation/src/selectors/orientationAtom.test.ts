import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import type { DeviceHarness } from "../../test/setup/deviceHarness"
import { installOrientation, orientationEvent } from "../../test/setup/orientationFixtures"
import { orientationSource } from "../lib/orientationSource"
import { alphaSelector } from "./alphaSelector"
import { compassHeadingSelector } from "./compassHeadingSelector"
import { FakeDeviceOrientationEvent } from "../../test/setup/orientationFixtures"
import { orientationAtom } from "./orientationAtom"
import { orientationStatusAtom } from "./orientationStatusAtom"

let harness: DeviceHarness | undefined
const install = () => (harness = installOrientation())
afterEach(() => {
    harness?.restore()
    harness = undefined
})

describe("orientationAtom", () => {
    test("a dormant read reports idle and attaches nothing", () => {
        const page = install()
        const app = store()
        expect(app.get(orientationAtom)).toBeNull()
        expect(app.get(orientationStatusAtom)).toBe("idle")
        expect(page.listeners("deviceorientation")).toBe(0)
        app.dispose()
    })

    test("subscribing attaches one listener and publishes readings with their status", () => {
        const page = install()
        const app = store()
        const seen: unknown[] = []
        const stop = app.sub(orientationAtom, () => {
            seen.push([app.get(orientationStatusAtom), app.get(orientationAtom)?.alpha])
        })
        expect(page.listeners("deviceorientation")).toBe(1)
        expect(app.get(orientationStatusAtom)).toBe("active")
        expect(app.get(orientationAtom)).toBeNull()

        page.fire(orientationEvent(0.5))
        page.fire(orientationEvent(0.7))
        expect(seen).toEqual([
            ["active", 0.5],
            ["active", 0.7],
        ])
        expect(app.get(alphaSelector)).toBe(0.7)

        stop()
        expect(page.listeners("deviceorientation")).toBe(0)
        app.dispose()
    })

    test("the last release discards the reading so a later attach never reports stale data", () => {
        const page = install()
        const app = store()
        app.sub(orientationAtom, () => {})
        page.fire(orientationEvent(1))
        expect(app.get(orientationAtom)?.alpha).toBe(1)
        app.dispose()

        const next = store()
        expect(next.get(orientationAtom)).toBeNull()
        expect(next.get(orientationStatusAtom)).toBe("idle")
        const stop = next.sub(orientationAtom, () => {})
        expect(next.get(orientationAtom)).toBeNull()
        stop()
        next.dispose()
    })

    test("independent stores share one window listener and both receive readings", () => {
        const page = install()
        const first = store()
        const second = store()
        const seen: string[] = []
        const stopFirst = first.sub(orientationAtom, () => seen.push("first"))
        const stopSecond = second.sub(orientationAtom, () => seen.push("second"))
        expect(page.listeners("deviceorientation")).toBe(1)

        page.fire(orientationEvent(2))
        expect(seen).toEqual(["first", "second"])

        stopFirst()
        expect(page.listeners("deviceorientation")).toBe(1)
        page.fire(orientationEvent(3))
        expect(second.get(orientationAtom)?.alpha).toBe(3)

        stopSecond()
        expect(page.listeners("deviceorientation")).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a child scope shares its root's registration", () => {
        const page = install()
        const app = store()
        const child = app.scope()
        const stopRoot = app.sub(orientationAtom, () => {})
        const stopChild = child.sub(orientationStatusAtom, () => {})
        expect(page.listeners("deviceorientation")).toBe(1)
        page.fire(orientationEvent(4))
        expect(child.get(orientationAtom)?.alpha).toBe(4)
        stopRoot()
        expect(page.listeners("deviceorientation")).toBe(1)
        stopChild()
        expect(page.listeners("deviceorientation")).toBe(0)
        child.dispose()
        app.dispose()
    })

    test("disposing a store with live subscribers releases its registration", () => {
        const page = install()
        const app = store()
        app.sub(orientationAtom, () => {})
        app.scope().sub(orientationAtom, () => {})
        expect(page.listeners("deviceorientation")).toBe(1)
        app.dispose()
        expect(page.listeners("deviceorientation")).toBe(0)
    })

    test("one throwing subscriber does not starve another store", () => {
        const page = install()
        const failing = store()
        const healthy = store()
        let healthyRuns = 0
        failing.sub(orientationAtom, () => {
            throw new Error("subscriber exploded")
        })
        healthy.sub(orientationAtom, () => healthyRuns++)

        const reported = page.fireReportingErrors(orientationEvent(5))
        expect(healthyRuns).toBe(1)
        expect(healthy.get(orientationAtom)?.alpha).toBe(5)
        expect(failing.get(orientationAtom)?.alpha).toBe(5)
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")

        failing.dispose()
        healthy.dispose()
        expect(page.listeners("deviceorientation")).toBe(0)
    })

    test("several failing stores are reported together after all ran", () => {
        const page = install()
        const stores = [store(), store(), store()]
        let healthyRuns = 0
        stores[0]!.sub(orientationAtom, () => {
            throw new Error("a")
        })
        stores[1]!.sub(orientationAtom, () => {
            throw new Error("b")
        })
        stores[2]!.sub(orientationAtom, () => healthyRuns++)
        const reported = page.fireReportingErrors(orientationEvent(6))
        expect(healthyRuns).toBe(1)
        expect(reported).toHaveLength(1)
        expect(reported[0]).toBeInstanceOf(AggregateError)
        expect((reported[0] as AggregateError).errors).toHaveLength(2)
        for (const app of stores) app.dispose()
    })

    test("missing DeviceOrientationEvent reports unsupported and attaches nothing", () => {
        const page = install()
        page.setGlobal("DeviceOrientationEvent", undefined)
        const app = store()
        const stop = app.sub(orientationAtom, () => {})
        expect(app.get(orientationStatusAtom)).toBe("unsupported")
        expect(page.listeners("deviceorientation")).toBe(0)
        stop()
        app.dispose()
    })

    test("an insecure context reports insecure and attaches nothing", () => {
        const page = install()
        page.setSecure(false)
        const app = store()
        const stop = app.sub(orientationAtom, () => {})
        expect(app.get(orientationStatusAtom)).toBe("insecure")
        expect(app.get(orientationAtom)).toBeNull()
        expect(page.listeners("deviceorientation")).toBe(0)
        stop()
        app.dispose()
    })

    test("compassHeadingSelector prefers iOS's webkitCompassHeading over alpha", () => {
        const page = install()
        const app = store()
        const stop = app.sub(compassHeadingSelector, () => {})
        page.fire(new FakeDeviceOrientationEvent({ alpha: 90 }))
        expect(app.get(compassHeadingSelector)).toBe(90)
        page.fire(new FakeDeviceOrientationEvent({ alpha: 90, webkitCompassHeading: 271.5 }))
        expect(app.get(compassHeadingSelector)).toBe(271.5)
        stop()
        app.dispose()
    })

    test("the server snapshot is a fixed idle seed", () => {
        install()
        expect(orientationSource.getServerSnapshot?.()).toEqual({
            status: "idle",
            orientation: null,
        })
    })

    test("the selectors are read-only", () => {
        install()
        const app = store()
        const loose = app as unknown as Record<"set" | "reset", (...args: unknown[]) => void>
        expect(() => loose.set(orientationAtom, null)).toThrow(TypeError)
        expect(() => loose.reset(orientationStatusAtom)).toThrow(TypeError)
        app.dispose()
    })
})
