import { afterEach, describe, expect, test } from "bun:test"
import { ExternalSourceOperationError, store } from "valdres"
import { installPageHarness, type PageHarness } from "../../test/setup/pageHarness"
import { ONLINE_UNAVAILABLE, onlineSource } from "../lib/onlineSource"
import { onlineAtom } from "./onlineAtom"

let harness: PageHarness | undefined
const install = (online: boolean) => {
    harness = installPageHarness()
    harness.setOnline(online)
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

const listeners = (page: PageHarness) => ({
    online: page.listeners("window", "online"),
    offline: page.listeners("window", "offline"),
})

describe("onlineAtom", () => {
    test("a dormant read samples navigator.onLine without attaching", () => {
        const page = install(false)
        const app = store()

        expect(app.get(onlineAtom)).toBe(false)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a dormant read observes a change the host never announced", () => {
        const page = install(true)
        const app = store()
        expect(app.get(onlineAtom)).toBe(true)

        page.setOnline(false)
        expect(app.get(onlineAtom)).toBe(false)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a subscriber attaches one online and one offline listener and sees both directions", () => {
        const page = install(true)
        const app = store()
        const seen: boolean[] = []

        const unsub = app.sub(onlineAtom, () => seen.push(app.get(onlineAtom)))
        expect(listeners(page)).toEqual({ online: 1, offline: 1 })

        page.setOnline(false)
        page.fire("window", "offline")
        page.setOnline(true)
        page.fire("window", "online")
        expect(seen).toEqual([false, true])

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("the value is navigator.onLine, not the name of the event that fired", () => {
        const page = install(true)
        const app = store()
        let notifications = 0
        const unsub = app.sub(onlineAtom, () => notifications++)

        // A spurious or out-of-order event cannot invent a state.
        page.fire("window", "offline")
        expect(app.get(onlineAtom)).toBe(true)
        expect(notifications).toBe(0)

        unsub()
        app.dispose()
    })

    test("two independent stores each own their physical listeners", () => {
        const page = install(true)
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(onlineAtom, () => seen.push("first"))
        const stopSecond = second.sub(onlineAtom, () => seen.push("second"))
        expect(listeners(page)).toEqual({ online: 2, offline: 2 })
        expect(page.attachCalls("window", "offline")).toBe(2)

        page.setOnline(false)
        page.fire("window", "offline")
        expect(seen.sort()).toEqual(["first", "second"])

        stopFirst()
        expect(listeners(page)).toEqual({ online: 1, offline: 1 })

        // The surviving store keeps receiving events after the other detaches.
        seen.length = 0
        page.setOnline(true)
        page.fire("window", "online")
        expect(seen).toEqual(["second"])
        expect(second.get(onlineAtom)).toBe(true)

        stopSecond()
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a child scope shares its root's attachment", () => {
        const page = install(true)
        const app = store()
        const child = app.scope()

        const stopRoot = app.sub(onlineAtom, () => {})
        const stopChild = child.sub(onlineAtom, () => {})
        expect(listeners(page)).toEqual({ online: 1, offline: 1 })

        page.setOnline(false)
        page.fire("window", "offline")
        expect(child.get(onlineAtom)).toBe(false)

        stopRoot()
        // The child still retains the tree's source.
        expect(listeners(page)).toEqual({ online: 1, offline: 1 })
        stopChild()
        expect(page.physical()).toBe(0)

        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases its listeners", () => {
        const page = install(true)
        const app = store()
        app.sub(onlineAtom, () => {})
        expect(page.physical()).toBe(2)

        app.dispose()
        expect(page.physical()).toBe(0)
    })

    test("detach then reattach re-samples a change made while dormant", () => {
        const page = install(true)
        const app = store()

        app.sub(onlineAtom, () => {})()
        page.setOnline(false)

        const stop = app.sub(onlineAtom, () => {})
        expect(app.get(onlineAtom)).toBe(false)
        stop()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("one throwing subscriber cannot starve another store", () => {
        const page = install(true)
        const failing = store()
        const healthy = store()
        let healthyRuns = 0
        const stopFailing = failing.sub(onlineAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(onlineAtom, () => healthyRuns++)

        page.setOnline(false)
        const reported = page.fireReportingErrors("window", "offline")

        expect(healthyRuns).toBe(1)
        expect(failing.get(onlineAtom)).toBe(false)
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")

        stopFailing()
        stopHealthy()
        failing.dispose()
        healthy.dispose()
    })

    test("a partial attachment failure releases the listener it already installed", () => {
        const page = install(true)
        const app = store()
        const boom = new Error("addEventListener rejected")
        page.failOnAttach("window", "offline", boom)

        let thrown: unknown
        try {
            app.sub(onlineAtom, () => {})
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(ExternalSourceOperationError)
        expect((thrown as ExternalSourceOperationError).cause).toBe(boom)
        expect(page.attachCalls("window", "online")).toBe(1)
        expect(page.physical()).toBe(0)

        page.failOnAttach("window", "offline", undefined)
        app.dispose()
    })

    test("the source is read-only browser truth", () => {
        install(true)
        const app = store()
        const loose = app as unknown as Record<
            "set" | "reset" | "update",
            (...args: unknown[]) => void
        >
        expect(() => loose.set(onlineAtom, false)).toThrow(TypeError)
        expect(() => loose.reset(onlineAtom)).toThrow(TypeError)
        expect(() => loose.update(onlineAtom, () => false)).toThrow(TypeError)
        expect(app.get(onlineAtom)).toBe(true)
        app.dispose()
    })

    test("the server snapshot is a fixed seed, whatever the live value", () => {
        install(false)
        expect(onlineSource.getServerSnapshot?.()).toBe(ONLINE_UNAVAILABLE)
        expect(ONLINE_UNAVAILABLE).toBe(true)
    })

    test("reports the unavailable value and attaches nothing without a boolean navigator.onLine", () => {
        const page = install(true)
        const native = Object.getOwnPropertyDescriptor(navigator, "onLine")!
        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            get: () => undefined,
        })
        try {
            const app = store()
            expect(app.get(onlineAtom)).toBe(ONLINE_UNAVAILABLE)
            const stop = app.sub(onlineAtom, () => {})
            expect(page.physical()).toBe(0)
            stop()
            app.dispose()
        } finally {
            Object.defineProperty(navigator, "onLine", native)
        }
    })
})
