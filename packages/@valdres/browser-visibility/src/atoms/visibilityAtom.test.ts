import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { installPageHarness, type PageHarness } from "../../test/setup/pageHarness"
import { VISIBILITY_UNAVAILABLE, visibilitySource } from "../lib/visibilitySource"
import { isVisibleSelector } from "../selectors/isVisibleSelector"
import { visibilityAtom } from "./visibilityAtom"

let harness: PageHarness | undefined
const install = (state: DocumentVisibilityState) => {
    harness = installPageHarness()
    harness.setVisibility(state)
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

const listeners = (page: PageHarness) =>
    page.listeners("document", "visibilitychange")

describe("visibilityAtom", () => {
    test("a dormant read samples document.visibilityState without attaching", () => {
        const page = install("hidden")
        const app = store()

        expect(app.get(visibilityAtom)).toBe("hidden")
        expect(app.get(isVisibleSelector)).toBe(false)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a dormant read observes a change the host never announced", () => {
        const page = install("visible")
        const app = store()
        expect(app.get(visibilityAtom)).toBe("visible")

        page.setVisibility("hidden")
        expect(app.get(visibilityAtom)).toBe("hidden")
        expect(app.get(isVisibleSelector)).toBe(false)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a direct subscriber attaches exactly one listener and sees changes", () => {
        const page = install("visible")
        const app = store()
        const seen: string[] = []

        const unsub = app.sub(visibilityAtom, () => seen.push(app.get(visibilityAtom)))
        expect(listeners(page)).toBe(1)

        page.setVisibility("hidden")
        page.fire("document", "visibilitychange")
        page.setVisibility("visible")
        page.fire("document", "visibilitychange")
        expect(seen).toEqual(["hidden", "visible"])

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("a transitive selector subscriber retains the source", () => {
        const page = install("visible")
        const app = store()
        const seen: boolean[] = []

        const unsub = app.sub(isVisibleSelector, () => seen.push(app.get(isVisibleSelector)))
        expect(listeners(page)).toBe(1)

        page.setVisibility("hidden")
        page.fire("document", "visibilitychange")
        expect(seen).toEqual([false])

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("an event that does not change the state notifies nobody", () => {
        const page = install("visible")
        const app = store()
        let notifications = 0
        const unsub = app.sub(isVisibleSelector, () => notifications++)

        page.fire("document", "visibilitychange")
        expect(notifications).toBe(0)

        unsub()
        app.dispose()
    })

    test("a legacy prerender state reads as hidden", () => {
        const page = install("visible")
        const app = store()
        page.setVisibility("prerender" as DocumentVisibilityState)
        expect(app.get(visibilityAtom)).toBe("hidden")
        expect(app.get(isVisibleSelector)).toBe(false)
        app.dispose()
    })

    test("two independent stores each own a physical listener", () => {
        const page = install("visible")
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(visibilityAtom, () => seen.push("first"))
        const stopSecond = second.sub(visibilityAtom, () => seen.push("second"))
        expect(listeners(page)).toBe(2)
        expect(page.attachCalls("document", "visibilitychange")).toBe(2)

        page.setVisibility("hidden")
        page.fire("document", "visibilitychange")
        expect(seen.sort()).toEqual(["first", "second"])

        stopFirst()
        expect(listeners(page)).toBe(1)

        seen.length = 0
        page.setVisibility("visible")
        page.fire("document", "visibilitychange")
        expect(seen).toEqual(["second"])
        expect(second.get(visibilityAtom)).toBe("visible")

        stopSecond()
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a child scope shares the tree projection instead of attaching again", () => {
        const page = install("visible")
        const app = store()
        const child = app.scope()

        const stopRoot = app.sub(visibilityAtom, () => {})
        const stopChild = child.sub(isVisibleSelector, () => {})
        expect(listeners(page)).toBe(1)

        page.setVisibility("hidden")
        page.fire("document", "visibilitychange")
        expect(child.get(isVisibleSelector)).toBe(false)

        stopChild()
        stopRoot()
        expect(page.physical()).toBe(0)
        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases the listener", () => {
        const page = install("visible")
        const app = store()
        app.sub(visibilityAtom, () => {})
        expect(listeners(page)).toBe(1)

        app.dispose()
        expect(page.physical()).toBe(0)
    })

    test("detach then reattach re-samples a change made while dormant", () => {
        const page = install("visible")
        const app = store()

        app.sub(visibilityAtom, () => {})()
        page.setVisibility("hidden")

        const stop = app.sub(visibilityAtom, () => {})
        expect(app.get(visibilityAtom)).toBe("hidden")
        stop()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("one throwing subscriber cannot starve another store", () => {
        const page = install("visible")
        const failing = store()
        const healthy = store()
        let healthyRuns = 0
        const stopFailing = failing.sub(visibilityAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(visibilityAtom, () => healthyRuns++)

        page.setVisibility("hidden")
        const reported = page.fireReportingErrors("document", "visibilitychange")

        expect(healthyRuns).toBe(1)
        expect(failing.get(visibilityAtom)).toBe("hidden")
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")

        stopFailing()
        stopHealthy()
        failing.dispose()
        healthy.dispose()
    })

    test("the source is read-only browser truth", () => {
        install("visible")
        const app = store()
        const loose = app as unknown as Record<
            "set" | "reset" | "update",
            (...args: unknown[]) => void
        >
        expect(() => loose.set(visibilityAtom, "hidden")).toThrow(TypeError)
        expect(() => loose.reset(visibilityAtom)).toThrow(TypeError)
        expect(() => loose.update(visibilityAtom, () => "hidden")).toThrow(TypeError)
        expect(() => loose.set(isVisibleSelector, false)).toThrow(TypeError)
        expect(app.get(visibilityAtom)).toBe("visible")
        app.dispose()
    })

    test("the server snapshot is a fixed seed, whatever the live value", () => {
        install("hidden")
        expect(visibilitySource.getServerSnapshot?.()).toBe(VISIBILITY_UNAVAILABLE)
        expect(VISIBILITY_UNAVAILABLE).toBe("visible")
    })
})
