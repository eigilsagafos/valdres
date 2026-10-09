import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { flush } from "../../test/setup/deviceHarness"
import {
    FakeScreen,
    installScreenDetails,
    type ScreenHarness,
} from "../../test/setup/screenFixtures"
import { screenDetailsAtom } from "../atoms/screenDetailsAtom"
import { screenPermissionAtom } from "../atoms/screenPermissionAtom"
import { currentScreenAtom } from "../selectors/currentScreenAtom"
import { screenDetailsStatusAtom } from "../selectors/screenDetailsStatusAtom"
import { screensAtom } from "../selectors/screensAtom"
import { requestScreenDetails } from "./requestScreenDetails"

let page: ScreenHarness | undefined
const install = () => (page = installScreenDetails())
afterEach(() => {
    page?.restore()
    page = undefined
})

describe("requestScreenDetails", () => {
    test("nothing is requested until it is called", () => {
        const harness = install()
        const app = store()
        const stop = app.sub(screenDetailsAtom, () => {})
        expect(app.get(screenDetailsStatusAtom)).toBe("idle")
        expect(app.get(screensAtom)).toEqual([])
        expect(harness.calls).toEqual([])
        stop()
        app.dispose()
    })

    test("calls getScreenDetails synchronously inside the user gesture", async () => {
        const harness = install()
        const app = store()
        const seen: string[] = []
        app.sub(screenDetailsStatusAtom, () => seen.push(app.get(screenDetailsStatusAtom)))
        const answer = harness.withActivation(() => requestScreenDetails())
        expect(harness.calls.map(call => call.activated)).toEqual([true])
        expect(app.get(screenDetailsStatusAtom)).toBe("pending")
        harness.grant()
        const screens = await answer
        expect(screens?.map(screen => screen.label)).toEqual(["Primary"])
        expect(seen).toEqual(["pending", "ready"])
        expect(app.get(currentScreenAtom)?.label).toBe("Primary")
        expect(app.get(screenPermissionAtom)).toBe("granted")
        app.dispose()
    })

    test("a denial rejects, reports denied coherently and records the permission", async () => {
        const harness = install()
        const app = store()
        const answer = requestScreenDetails()
        harness.deny()
        await expect(answer).rejects.toThrow("Permission denied")
        expect(app.get(screenDetailsAtom)).toEqual({
            status: "denied",
            screens: [],
            currentScreen: null,
            error: { name: "NotAllowedError", message: "Permission denied" },
        })
        expect(app.get(screenPermissionAtom)).toBe("denied")
        app.dispose()
    })

    test("recovers from a denial when a later request is granted", async () => {
        const harness = install()
        const app = store()
        const denied = requestScreenDetails()
        harness.deny()
        await denied.catch(() => {})
        const granted = requestScreenDetails()
        expect(app.get(screenDetailsStatusAtom)).toBe("pending")
        harness.grant()
        await granted
        expect(app.get(screenDetailsAtom)).toMatchObject({ status: "ready", error: null })
        expect(app.get(screenPermissionAtom)).toBe("granted")
        app.dispose()
    })

    test("other failures report error and leave the permission alone", async () => {
        const harness = install()
        const app = store()
        const answer = requestScreenDetails()
        harness.calls.shift()!.answer.reject(new Error("host failure"))
        await expect(answer).rejects.toThrow("host failure")
        expect(app.get(screenDetailsAtom).error).toEqual({ name: "Error", message: "host failure" })
        expect(app.get(screenDetailsStatusAtom)).toBe("error")
        expect(app.get(screenPermissionAtom)).toBe("prompt")
        app.dispose()
    })

    test("a synchronous throw from getScreenDetails rejects and reports error", async () => {
        const harness = install()
        harness.setGlobal("getScreenDetails", () => {
            throw new TypeError("boom")
        })
        const app = store()
        await expect(requestScreenDetails()).rejects.toThrow("boom")
        expect(app.get(screenDetailsStatusAtom)).toBe("error")
        app.dispose()
    })

    test("concurrent calls share one browser request", async () => {
        const harness = install()
        const first = requestScreenDetails()
        const second = requestScreenDetails()
        expect(second).toBe(first)
        expect(harness.calls).toHaveLength(1)
        harness.grant()
        await second
    })

    test("a repeated request on a ready page keeps serving and publishes nothing new", async () => {
        const harness = install()
        const app = store()
        const first = requestScreenDetails()
        harness.grant()
        await first
        const state = app.get(screenDetailsAtom)
        let notified = 0
        app.sub(screenDetailsAtom, () => notified++)
        const again = requestScreenDetails()
        expect(app.get(screenDetailsStatusAtom)).toBe("ready")
        harness.grant()
        await again
        expect(app.get(screenDetailsAtom)).toBe(state)
        expect(notified).toBe(0)
        app.dispose()
    })

    test("a request answered after every store was disposed still records page truth", async () => {
        const harness = install()
        const app = store()
        app.sub(screensAtom, () => {})
        const answer = requestScreenDetails()
        app.dispose()
        harness.grant()
        await answer
        // Nothing retains the source: no listeners were attached.
        expect(harness.details.physical()).toBe(0)
        const next = store()
        expect(next.get(screenDetailsStatusAtom)).toBe("ready")
        next.dispose()
    })

    test("unsupported and insecure hosts resolve null and stay put", async () => {
        const harness = install()
        const app = store()
        harness.setSecure(false)
        await expect(requestScreenDetails()).resolves.toBeNull()
        expect(app.get(screenDetailsStatusAtom)).toBe("insecure")
        expect(app.get(screenPermissionAtom)).toBe("unsupported")
        harness.setSecure(undefined)
        harness.setGlobal("getScreenDetails", undefined)
        await expect(requestScreenDetails()).resolves.toBeNull()
        expect(app.get(screenDetailsStatusAtom)).toBe("unsupported")
        expect(harness.calls).toEqual([])
        app.dispose()
    })
})

describe("screenDetailsAtom after access is granted", () => {
    const grantFirst = async () => {
        const harness = install()
        const answer = requestScreenDetails()
        harness.grant()
        await answer
        return harness
    }

    test("listeners exist only while a store tree retains the source", async () => {
        const harness = await grantFirst()
        const app = store()
        expect(app.get(screensAtom)).toHaveLength(1)
        expect(harness.details.physical()).toBe(0)
        const stop = app.sub(screensAtom, () => {})
        // screenschange + currentscreenchange + one per screen.
        expect(harness.details.physical()).toBe(3)
        stop()
        expect(harness.details.physical()).toBe(0)
        app.dispose()
    })

    test("granting while subscribed attaches immediately", async () => {
        const harness = install()
        const app = store()
        app.sub(screensAtom, () => {})
        const answer = requestScreenDetails()
        expect(harness.details.physical()).toBe(0)
        harness.grant()
        await answer
        expect(harness.details.physical()).toBe(3)
        app.dispose()
        expect(harness.details.physical()).toBe(0)
    })

    test("screenschange, currentscreenchange and per-screen changes update every store", async () => {
        const harness = await grantFirst()
        const first = store()
        const second = store()
        first.sub(screensAtom, () => {})
        second.sub(currentScreenAtom, () => {})
        // Two trees, one set of listeners per window.
        expect(harness.details.physical()).toBe(3)

        const external = new FakeScreen({ label: "External", left: 1920, isPrimary: false })
        harness.details.screens = [harness.details.screens[0]!, external]
        harness.details.dispatchEvent(new Event("screenschange"))
        expect(first.get(screensAtom).map(screen => screen.label)).toEqual(["Primary", "External"])
        expect(harness.details.physical()).toBe(4)

        harness.details.currentScreen = external
        harness.details.dispatchEvent(new Event("currentscreenchange"))
        expect(second.get(currentScreenAtom)?.label).toBe("External")

        external.change({ width: 2560 })
        expect(first.get(screensAtom)[1]!.width).toBe(2560)
        expect(second.get(currentScreenAtom)?.width).toBe(2560)

        first.dispose()
        second.dispose()
        expect(harness.details.physical()).toBe(0)
    })

    test("an event that changes nothing publishes nothing", async () => {
        const harness = await grantFirst()
        const app = store()
        let notified = 0
        app.sub(screensAtom, () => notified++)
        harness.details.dispatchEvent(new Event("screenschange"))
        harness.details.screens[0]!.change({})
        expect(notified).toBe(0)
        app.dispose()
    })

    test("a dormant read samples the platform without attaching", async () => {
        const harness = await grantFirst()
        const app = store()
        harness.details.screens[0]!.width = 1280
        expect(app.get(screensAtom)[0]!.width).toBe(1280)
        expect(harness.details.physical()).toBe(0)
        app.dispose()
    })

    test("a child scope shares its root's registration", async () => {
        const harness = await grantFirst()
        const app = store()
        const child = app.scope()
        const stopRoot = app.sub(screensAtom, () => {})
        const stopChild = child.sub(currentScreenAtom, () => {})
        expect(harness.details.physical()).toBe(3)
        stopRoot()
        expect(harness.details.physical()).toBe(3)
        stopChild()
        expect(harness.details.physical()).toBe(0)
        app.dispose()
    })

    test("one throwing subscriber does not starve another store", async () => {
        const harness = await grantFirst()
        const failing = store()
        const healthy = store()
        failing.sub(screensAtom, () => {
            throw new Error("subscriber exploded")
        })
        let healthyRuns = 0
        healthy.sub(screensAtom, () => healthyRuns++)
        const reported = harness.details.screens[0]!.changeReportingErrors({ left: 100 })
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")
        expect(healthyRuns).toBe(1)
        expect(healthy.get(screensAtom)[0]!.left).toBe(100)
        failing.dispose()
        healthy.dispose()
    })

    test("a revoked permission drops the screens and their listeners", async () => {
        const harness = install()
        const permissions = harness.installPermissions()
        permissions.set("window-management", "prompt")
        const app = store()
        app.sub(screensAtom, () => {})
        app.sub(screenPermissionAtom, () => {})
        await flush()
        const answer = requestScreenDetails()
        harness.grant()
        await answer
        expect(app.get(screensAtom)).toHaveLength(1)
        permissions.statuses.get("window-management")!.change("denied")
        expect(app.get(screenDetailsAtom)).toMatchObject({ status: "denied", screens: [] })
        expect(app.get(screenPermissionAtom)).toBe("denied")
        expect(harness.details.physical()).toBe(0)
        app.dispose()
    })
})
