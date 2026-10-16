import { afterEach, describe, expect, test } from "bun:test"
import {
    atom,
    ExternalSourceOperationError,
    selector,
    store,
    type Atom,
} from "valdres"
import {
    installGeometryHarness,
    type GeometryHarness,
} from "../../test/setup/geometryHarness"
import {
    WINDOW_SIZE_UNAVAILABLE,
    windowSizeSource,
} from "../lib/windowSizeSource"
import type { WindowSize } from "../types/WindowSize"
import { windowSizeAtom } from "./windowSizeAtom"

let harness: GeometryHarness | undefined
const install = () => {
    harness = installGeometryHarness()
    harness.setWindow({
        innerWidth: 1024,
        innerHeight: 768,
        outerWidth: 1040,
        outerHeight: 860,
    })
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

const resizeListeners = (page: GeometryHarness) =>
    page.listeners("window", "resize")

const isDesktop = selector(get => get(windowSizeAtom).innerWidth >= 768, {
    name: "test/isDesktop",
})

describe("windowSizeAtom", () => {
    test("a dormant read measures the window without attaching", () => {
        const page = install()
        const app = store()

        expect(app.get(windowSizeAtom)).toEqual({
            innerWidth: 1024,
            innerHeight: 768,
            outerWidth: 1040,
            outerHeight: 860,
        })
        expect(app.get(isDesktop)).toBe(true)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("an unchanged measurement is the same frozen object, for every store", () => {
        install()
        const first = store()
        const second = store()

        const snapshot = first.get(windowSizeAtom)
        expect(Object.isFrozen(snapshot)).toBe(true)
        expect(first.get(windowSizeAtom)).toBe(snapshot)
        expect(second.get(windowSizeAtom)).toBe(snapshot)
        expect(windowSizeSource.getSnapshot()).toBe(snapshot)

        first.dispose()
        second.dispose()
    })

    test("a dormant read observes a resize the host never announced", () => {
        const page = install()
        const app = store()
        const before = app.get(windowSizeAtom)

        page.setWindow({ innerWidth: 500 })
        const after = app.get(windowSizeAtom)
        expect(after).not.toBe(before)
        expect(after.innerWidth).toBe(500)
        expect(app.get(isDesktop)).toBe(false)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a direct subscriber attaches exactly one resize listener and follows it", () => {
        const page = install()
        const app = store()
        const seen: WindowSize[] = []

        const unsub = app.sub(windowSizeAtom, () =>
            seen.push(app.get(windowSizeAtom)),
        )
        expect(page.attached()).toEqual({ "window:resize": 1 })

        page.setWindow({ innerWidth: 800, outerWidth: 816 })
        page.fire("window", "resize")
        page.setWindow({ innerHeight: 600 })
        page.fire("window", "resize")
        expect(seen.map(size => [size.innerWidth, size.innerHeight])).toEqual([
            [800, 768],
            [800, 600],
        ])
        expect(seen[0]!.outerWidth).toBe(816)

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("a transitive selector subscriber retains the source", () => {
        const page = install()
        const app = store()
        const seen: boolean[] = []

        const unsub = app.sub(isDesktop, () => seen.push(app.get(isDesktop)))
        expect(resizeListeners(page)).toBe(1)

        page.setWindow({ innerWidth: 400 })
        page.fire("window", "resize")
        expect(seen).toEqual([false])

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("a resize that changes nothing notifies nobody and keeps the snapshot", () => {
        const page = install()
        const app = store()
        let notifications = 0
        const unsub = app.sub(windowSizeAtom, () => notifications++)
        const before = app.get(windowSizeAtom)

        page.fire("window", "resize")
        page.fire("window", "resize")
        expect(notifications).toBe(0)
        expect(app.get(windowSizeAtom)).toBe(before)

        unsub()
        app.dispose()
    })

    test("a selector below the source suppresses changes that do not move it", () => {
        const page = install()
        const app = store()
        let atom = 0
        let desktop = 0
        const stopAtom = app.sub(windowSizeAtom, () => atom++)
        const stopDesktop = app.sub(isDesktop, () => desktop++)

        for (const innerWidth of [1000, 900, 800]) {
            page.setWindow({ innerWidth })
            page.fire("window", "resize")
        }
        expect({ atom, desktop }).toEqual({ atom: 3, desktop: 0 })

        page.setWindow({ innerWidth: 700 })
        page.fire("window", "resize")
        expect({ atom, desktop }).toEqual({ atom: 4, desktop: 1 })

        stopDesktop()
        stopAtom()
        app.dispose()
    })

    test("inner and outer sizes are published together, never torn", () => {
        const page = install()
        const app = store()
        const computed: string[] = []
        const pair = selector(get => {
            const size = get(windowSizeAtom)
            const text = `${size.innerWidth}x${size.innerHeight}/${size.outerWidth}x${size.outerHeight}`
            computed.push(text)
            return text
        })
        const seen: string[] = []
        const unsub = app.sub(pair, () => seen.push(app.get(pair)))
        computed.length = 0

        page.setWindow({
            innerWidth: 600,
            innerHeight: 400,
            outerWidth: 616,
            outerHeight: 492,
        })
        page.fire("window", "resize")

        expect(computed).toEqual(["600x400/616x492"])
        expect(seen).toEqual(["600x400/616x492"])

        unsub()
        app.dispose()
    })

    test("a settle handler sees the whole new size in the same update", () => {
        const page = install()
        const app = store()
        const breakpoint: Atom<string> = atom("unknown")
        const stop = app.sub(windowSizeAtom, {
            settle: tx => {
                const { innerWidth, innerHeight } = tx.get(windowSizeAtom)
                tx.set(
                    breakpoint,
                    `${innerWidth >= 768 ? "wide" : "narrow"}:${innerHeight}`,
                )
            },
        })
        const seen: string[] = []
        const stopSeen = app.sub(breakpoint, () =>
            seen.push(app.get(breakpoint)),
        )

        page.setWindow({ innerWidth: 500, innerHeight: 900 })
        page.fire("window", "resize")
        expect(seen).toEqual(["narrow:900"])
        expect(app.get(breakpoint)).toBe("narrow:900")

        stopSeen()
        stop()
        app.dispose()
    })

    test("two independent stores each own a physical listener", () => {
        const page = install()
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(windowSizeAtom, () => seen.push("first"))
        const stopSecond = second.sub(windowSizeAtom, () => seen.push("second"))
        expect(resizeListeners(page)).toBe(2)
        expect(page.attachCalls("window", "resize")).toBe(2)

        page.setWindow({ innerWidth: 640 })
        page.fire("window", "resize")
        expect(seen.sort()).toEqual(["first", "second"])
        // Both stores serve the one shared snapshot.
        expect(first.get(windowSizeAtom)).toBe(second.get(windowSizeAtom))

        stopFirst()
        expect(resizeListeners(page)).toBe(1)

        seen.length = 0
        page.setWindow({ innerWidth: 641 })
        page.fire("window", "resize")
        expect(seen).toEqual(["second"])

        stopSecond()
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a child scope shares its root's attachment", () => {
        const page = install()
        const app = store()
        const child = app.scope()

        const stopRoot = app.sub(windowSizeAtom, () => {})
        const stopChild = child.sub(isDesktop, () => {})
        expect(resizeListeners(page)).toBe(1)

        page.setWindow({ innerWidth: 320 })
        page.fire("window", "resize")
        expect(child.get(isDesktop)).toBe(false)

        stopRoot()
        expect(resizeListeners(page)).toBe(1)
        stopChild()
        expect(page.physical()).toBe(0)
        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases the listener", () => {
        const page = install()
        const app = store()
        const child = app.scope("panel")
        child.sub(windowSizeAtom, () => {})
        app.sub(isDesktop, () => {})
        expect(resizeListeners(page)).toBe(1)

        app.dispose()
        expect(page.physical()).toBe(0)
    })

    test("detach then reattach re-measures a resize made while dormant", () => {
        const page = install()
        const app = store()

        app.sub(windowSizeAtom, () => {})()
        page.setWindow({ innerWidth: 300, innerHeight: 200 })

        const stop = app.sub(windowSizeAtom, () => {})
        expect(app.get(windowSizeAtom).innerWidth).toBe(300)
        expect(resizeListeners(page)).toBe(1)

        page.setWindow({ innerWidth: 301 })
        page.fire("window", "resize")
        expect(app.get(windowSizeAtom).innerWidth).toBe(301)

        stop()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("one throwing subscriber cannot starve another store", () => {
        const page = install()
        const failing = store()
        const healthy = store()
        let healthyRuns = 0
        const stopFailing = failing.sub(windowSizeAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(windowSizeAtom, () => healthyRuns++)

        page.setWindow({ innerWidth: 900 })
        const reported = page.fireReportingErrors("window", "resize")

        expect(healthyRuns).toBe(1)
        expect(failing.get(windowSizeAtom).innerWidth).toBe(900)
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")

        stopFailing()
        stopHealthy()
        failing.dispose()
        healthy.dispose()
    })

    test("an attachment failure surfaces, leaves nothing attached, and a later subscription recovers", () => {
        const page = install()
        const app = store()
        const boom = new Error("addEventListener rejected")
        page.failOnAttach("window", "resize", boom)

        let thrown: unknown
        try {
            app.sub(windowSizeAtom, () => {})
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(ExternalSourceOperationError)
        expect((thrown as ExternalSourceOperationError).cause).toBe(boom)
        expect(page.physical()).toBe(0)

        page.failOnAttach("window", "resize", undefined)
        const seen: number[] = []
        const stop = app.sub(windowSizeAtom, () =>
            seen.push(app.get(windowSizeAtom).innerWidth),
        )
        expect(resizeListeners(page)).toBe(1)
        page.setWindow({ innerWidth: 999 })
        page.fire("window", "resize")
        expect(seen).toEqual([999])

        stop()
        app.dispose()
    })

    test("a cleanup failure surfaces from the unsubscribe that caused it", () => {
        const page = install()
        const app = store()
        const boom = new Error("removeEventListener rejected")
        const stop = app.sub(windowSizeAtom, () => {})
        page.failOnDetach("window", "resize", boom)

        let thrown: unknown
        try {
            stop()
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(ExternalSourceOperationError)
        expect(thrown).toMatchObject({ cause: boom, phase: "cleanup" })

        // The store stays usable: a new subscription attaches its own listener.
        page.failOnDetach("window", "resize", undefined)
        const again = app.sub(windowSizeAtom, () => {})
        page.setWindow({ innerWidth: 777 })
        page.fire("window", "resize")
        expect(app.get(windowSizeAtom).innerWidth).toBe(777)
        again()
        app.dispose()
    })

    test("the source is read-only browser truth", () => {
        install()
        const app = store()
        const loose = app as unknown as Record<
            "set" | "reset" | "update",
            (...args: unknown[]) => void
        >
        expect(() =>
            loose.set(windowSizeAtom, WINDOW_SIZE_UNAVAILABLE),
        ).toThrow(TypeError)
        expect(() => loose.reset(windowSizeAtom)).toThrow(TypeError)
        expect(() =>
            loose.update(windowSizeAtom, (size: WindowSize) => size),
        ).toThrow(TypeError)
        expect(app.get(windowSizeAtom).innerWidth).toBe(1024)
        app.dispose()
    })

    test("an app-owned override stays local to the store that set it", () => {
        const page = install()
        // Configuration is the app's: an ordinary atom, so each store tree
        // has its own. The package keeps no writable state of its own.
        const forcedWidth = atom<number | null>(null)
        const layoutWidth = selector(
            get => get(forcedWidth) ?? get(windowSizeAtom).innerWidth,
        )
        const first = store()
        const second = store()
        first.set(forcedWidth, 375)

        expect(first.get(layoutWidth)).toBe(375)
        expect(second.get(layoutWidth)).toBe(1024)

        const stop = second.sub(layoutWidth, () => {})
        page.setWindow({ innerWidth: 1280 })
        page.fire("window", "resize")
        expect(second.get(layoutWidth)).toBe(1280)
        expect(first.get(layoutWidth)).toBe(375)

        stop()
        first.dispose()
        second.dispose()
    })

    test("the server snapshot is a fixed frozen seed, whatever the live size", () => {
        install()
        expect(windowSizeSource.getServerSnapshot?.()).toBe(
            WINDOW_SIZE_UNAVAILABLE,
        )
        expect(WINDOW_SIZE_UNAVAILABLE).toEqual({
            innerWidth: 0,
            innerHeight: 0,
            outerWidth: 0,
            outerHeight: 0,
        })
        expect(Object.isFrozen(WINDOW_SIZE_UNAVAILABLE)).toBe(true)
    })
})
