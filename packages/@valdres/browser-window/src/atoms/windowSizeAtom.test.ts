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
const install = (options?: Parameters<typeof installGeometryHarness>[0]) => {
    harness = installGeometryHarness(options)
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

    test("documented limit: another store's read of a passing size can cause one equal-valued notification (review R6)", () => {
        // The source keeps one shared last snapshot. Pinned so a change to
        // this behavior is deliberate and the Snapshots docs move with it.
        const page = install()
        const subscribed = store()
        const reader = store()
        let notifications = 0
        const stop = subscribed.sub(windowSizeAtom, () => notifications++)
        const published = subscribed.get(windowSizeAtom)

        page.setWindow({ outerWidth: 2000 })
        reader.get(windowSizeAtom) // an unsubscribed read sees the passing size
        page.setWindow({ outerWidth: 1040 }) // back to what was published
        page.fire("window", "resize")

        expect(notifications).toBe(1)
        expect(subscribed.get(windowSizeAtom)).not.toBe(published)
        expect(subscribed.get(windowSizeAtom)).toEqual(published)

        stop()
        subscribed.dispose()
        reader.dispose()
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

describe("the follow-up measurements after resize", () => {
    // Chromium dispatches `resize` while outerWidth/outerHeight still report
    // the previous bounds, then updates them by the second or third animation
    // frame without another event (scripts/browser-geometry-probe). The
    // harness reproduces that order; it cannot establish the timing itself.
    const resizeWithStaleOuter = (page: GeometryHarness) => {
        page.setWindow({ innerWidth: 884, innerHeight: 557 })
        page.fire("window", "resize")
    }
    const outerCatchesUp = (page: GeometryHarness) =>
        page.setWindow({ outerWidth: 900, outerHeight: 700 })
    const frames = (page: GeometryHarness, count: number) => {
        for (let i = 0; i < count; i++) page.frame()
    }

    for (const catchUp of [1, 2, 3] as const) {
        test(`an outer size that catches up during frame ${catchUp} is published by the next re-measurement`, () => {
            const page = install()
            const app = store()
            const seen: string[] = []
            const unsub = app.sub(windowSizeAtom, () => {
                const size = app.get(windowSizeAtom)
                seen.push(
                    `${size.innerWidth}x${size.innerHeight}/${size.outerWidth}x${size.outerHeight}`,
                )
            })

            resizeWithStaleOuter(page)
            expect(seen).toEqual(["884x557/1040x860"])
            frames(page, catchUp)
            outerCatchesUp(page)
            // Re-measurements run on frames 2, 3 and 4 after the event.
            const correctedOn = Math.max(catchUp + 1, 2)
            frames(page, correctedOn - catchUp - 1)
            expect(seen).toHaveLength(1)
            page.frame()
            expect(seen).toEqual(["884x557/1040x860", "884x557/900x700"])

            frames(page, 4)
            expect(seen).toHaveLength(2)
            expect(page.pendingFrames()).toBe(0)

            unsub()
            app.dispose()
        })
    }

    test("the sequence is bounded: re-measures on frames 2-4, then stops", () => {
        const page = install()
        let invalidations = 0
        const release = windowSizeSource.subscribe(() => invalidations++)

        page.fire("window", "resize")
        expect(invalidations).toBe(1)
        const perFrame = [0, 1, 2, 3, 4, 5].map(() => {
            page.frame()
            return invalidations
        })
        expect(perFrame).toEqual([1, 2, 3, 4, 4, 4])
        expect(page.pendingFrames()).toBe(0)
        expect(page.frameCalls().requested).toBe(4)

        release()
    })

    test("notifies nobody when a re-measurement reads what was already published", () => {
        const page = install()
        const app = store()
        let notifications = 0
        const unsub = app.sub(windowSizeAtom, () => notifications++)

        page.setWindow({ innerWidth: 700, outerWidth: 716 })
        page.fire("window", "resize")
        expect(notifications).toBe(1)
        const published = app.get(windowSizeAtom)
        frames(page, 4)
        expect(notifications).toBe(1)
        expect(app.get(windowSizeAtom)).toBe(published)

        // A resize that changed nothing, and its re-measurements: nothing at all.
        page.fire("window", "resize")
        frames(page, 4)
        expect(notifications).toBe(1)

        unsub()
        app.dispose()
    })

    test("a burst of resizes leaves one sequence, counted from the last", () => {
        const page = install()
        let invalidations = 0
        const release = windowSizeSource.subscribe(() => invalidations++)

        page.fire("window", "resize")
        page.frame() // the first resize's sequence is one frame in
        page.fire("window", "resize")
        page.fire("window", "resize")
        expect(invalidations).toBe(3)
        expect(page.pendingFrames()).toBe(1)

        page.frame() // the first resize's frame 2: superseded, nothing runs
        expect(invalidations).toBe(3)
        page.frame() // the last resize's frame 2
        expect(invalidations).toBe(4)
        frames(page, 2)
        expect(invalidations).toBe(6)
        frames(page, 2)
        expect(invalidations).toBe(6)
        expect(page.pendingFrames()).toBe(0)

        release()
    })

    test("an older sequence that still runs cannot measure or request frames", () => {
        // A host whose cancelAnimationFrame does nothing still runs callbacks
        // a newer resize replaced; the generation guard drops them.
        const page = install({ animationFrames: "ignore-cancel" })
        let invalidations = 0
        const release = windowSizeSource.subscribe(() => invalidations++)

        page.fire("window", "resize")
        page.frame()
        page.fire("window", "resize")
        expect(invalidations).toBe(2)
        const requested = page.frameCalls().requested
        page.frame() // both sequences' callbacks run; only the newer continues
        expect(page.frameCalls().requested).toBe(requested + 1)
        expect(invalidations).toBe(2)
        frames(page, 3)
        expect(invalidations).toBe(5)

        page.fire("window", "resize")
        release()
        frames(page, 4)
        expect(invalidations).toBe(6)
    })

    test("a rapid resize sequence publishes the final sizes, inner and outer", () => {
        const page = install()
        const app = store()
        const seen: WindowSize[] = []
        const unsub = app.sub(windowSizeAtom, () =>
            seen.push(app.get(windowSizeAtom)),
        )

        for (const width of [1000, 960, 920, 880]) {
            page.setWindow({ innerWidth: width - 16 })
            page.fire("window", "resize")
            page.setWindow({ outerWidth: width })
        }
        // Each immediate reading carries the previous outer size.
        expect(seen.at(-1)).toMatchObject({ innerWidth: 864, outerWidth: 920 })
        frames(page, 4)
        expect(seen.at(-1)).toMatchObject({ innerWidth: 864, outerWidth: 880 })
        expect(seen).toHaveLength(5)

        unsub()
        app.dispose()
    })

    test("unsubscribing cancels the pending re-measurements", () => {
        const page = install()
        const app = store()
        const unsub = app.sub(windowSizeAtom, () => {})
        resizeWithStaleOuter(page)
        page.frame()
        expect(page.pendingFrames()).toBe(1)

        unsub()
        expect(page.pendingFrames()).toBe(0)
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("disposing the store cancels the pending re-measurements", () => {
        const page = install()
        const app = store()
        app.scope("panel").sub(windowSizeAtom, () => {})
        resizeWithStaleOuter(page)
        frames(page, 2)
        expect(page.pendingFrames()).toBe(1)

        app.dispose()
        expect(page.pendingFrames()).toBe(0)
        expect(page.physical()).toBe(0)
    })

    test("each store tree runs its own sequence; a child scope shares its root's", () => {
        const page = install()
        const first = store()
        const second = store()
        const child = first.scope()
        const seen: string[] = []
        const stops = [
            first.sub(windowSizeAtom, () => seen.push("first")),
            child.sub(windowSizeAtom, () => seen.push("child")),
            second.sub(windowSizeAtom, () => seen.push("second")),
        ]

        resizeWithStaleOuter(page)
        expect(page.pendingFrames()).toBe(2)
        outerCatchesUp(page)
        seen.length = 0
        frames(page, 4)
        expect(seen.sort()).toEqual(["child", "first", "second"])
        expect(first.get(windowSizeAtom)).toBe(second.get(windowSizeAtom))

        for (const stop of stops) stop()
        expect(page.pendingFrames()).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a throwing subscriber cannot end the sequence early", () => {
        const page = install()
        const app = store()
        let calls = 0
        const unsub = app.sub(windowSizeAtom, () => {
            calls++
            throw new Error("subscriber exploded")
        })

        page.setWindow({ innerWidth: 884 })
        const reported = page.fireReportingErrors("window", "resize")
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")
        expect(page.pendingFrames()).toBe(1)
        page.frame()
        page.setWindow({ outerWidth: 900 })
        expect(() => page.frame()).toThrow() // frame 2 publishes the outer size
        page.setWindow({ outerHeight: 700 })
        expect(() => page.frame()).toThrow() // frame 3 still runs
        expect(calls).toBe(3)
        expect(app.get(windowSizeAtom)).toMatchObject({
            outerWidth: 900,
            outerHeight: 700,
        })

        unsub()
        app.dispose()
    })

    test("while frames are suspended the correction waits, then lands when they resume", async () => {
        // A hidden tab runs no animation frames. Nothing polls in between:
        // time passing schedules no further work.
        const page = install()
        const app = store()
        const unsub = app.sub(windowSizeAtom, () => {})
        resizeWithStaleOuter(page)
        outerCatchesUp(page)
        expect(app.get(windowSizeAtom).outerWidth).toBe(1040)
        expect(page.frameCalls().requested).toBe(1)

        await Bun.sleep(50)
        expect(page.frameCalls().requested).toBe(1)
        expect(app.get(windowSizeAtom).outerWidth).toBe(1040)
        frames(page, 2)
        expect(app.get(windowSizeAtom).outerWidth).toBe(900)

        unsub()
        app.dispose()
    })

    test("a listener invoked after its release schedules nothing (review R5)", () => {
        const page = install()
        let invalidations = 0
        const release = windowSizeSource.subscribe(() => invalidations++)
        const [listener] = page.snapshotListeners("window", "resize")
        release()
        const requested = page.frameCalls().requested

        ;(listener as () => void)()
        frames(page, 5)
        expect(invalidations).toBe(0)
        expect(page.frameCalls().requested).toBe(requested)
        expect(page.pendingFrames()).toBe(0)
    })

    test("after a refused listener removal, later resizes schedule no work", () => {
        const page = install()
        const app = store()
        let notifications = 0
        const stop = app.sub(windowSizeAtom, () => notifications++)
        page.failOnDetach("window", "resize", new Error("removal refused"))
        expect(stop).toThrow(ExternalSourceOperationError)
        // The host kept the listener attached.
        expect(page.listeners("window", "resize")).toBe(1)
        const requested = page.frameCalls().requested

        page.setWindow({ innerWidth: 640 })
        page.fire("window", "resize")
        frames(page, 5)
        expect(page.frameCalls().requested).toBe(requested)
        expect(page.pendingFrames()).toBe(0)
        expect(notifications).toBe(0)

        page.failOnDetach("window", "resize", undefined)
        app.dispose()
    })

    test("a throwing cancelAnimationFrame still removes the listener and voids the sequence", () => {
        const page = install()
        const app = store()
        let notifications = 0
        const stop = app.sub(windowSizeAtom, () => notifications++)
        resizeWithStaleOuter(page)
        page.frame()
        const boom = new Error("cancelAnimationFrame rejected")
        const cancel = window.cancelAnimationFrame
        window.cancelAnimationFrame = () => {
            throw boom
        }
        let thrown: unknown
        try {
            stop()
        } catch (error) {
            thrown = error
        } finally {
            window.cancelAnimationFrame = cancel
        }
        expect(thrown).toBeInstanceOf(ExternalSourceOperationError)
        expect(thrown).toMatchObject({ cause: boom, phase: "cleanup" })
        expect(page.physical()).toBe(0)

        // The frame the host failed to cancel still runs, and does nothing.
        const before = notifications
        outerCatchesUp(page)
        frames(page, 4)
        expect(notifications).toBe(before)
        expect(page.pendingFrames()).toBe(0)
        app.dispose()
    })

    test("a store whose subscriber throws in a re-measurement does not starve another store's correction", () => {
        // Review R3': frames keep delivering after a throwing callback, as in
        // a browser, and the error is reported.
        const page = install()
        const failing = store()
        const healthy = store()
        let sibling = 0
        let other = 0
        const stops = [
            failing.sub(windowSizeAtom, () => {
                throw new Error("subscriber exploded")
            }),
            failing.sub(windowSizeAtom, () => sibling++),
            healthy.sub(windowSizeAtom, () => other++),
        ]
        page.fireReportingErrors("window", "resize")
        page.frame()
        page.setWindow({ outerWidth: 1 })
        const reported = page.frameReportingErrors()
        expect([sibling, other, reported.length]).toEqual([1, 1, 1])
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")

        page.setWindow({ outerWidth: 2 })
        expect(page.frameReportingErrors()).toHaveLength(1)
        page.frame()
        expect([sibling, other, page.pendingFrames()]).toEqual([2, 2, 0])
        expect(healthy.get(windowSizeAtom).outerWidth).toBe(2)

        for (const stop of stops) stop()
        failing.dispose()
        healthy.dispose()
    })

    test("without requestAnimationFrame, nothing falls back to timers", async () => {
        const page = install({ animationFrames: "absent" })
        const app = store()
        const seen: number[] = []
        const unsub = app.sub(windowSizeAtom, () =>
            seen.push(app.get(windowSizeAtom).outerWidth),
        )
        const scheduled: string[] = []
        const restore: (() => void)[] = []
        for (const name of [
            "setTimeout",
            "setInterval",
            "queueMicrotask",
            "requestIdleCallback",
        ] as const) {
            const original = (globalThis as Record<string, unknown>)[name]
            ;(globalThis as Record<string, unknown>)[name] = (
                ...args: unknown[]
            ) => {
                scheduled.push(name)
                return typeof original === "function"
                    ? original(...args)
                    : undefined
            }
            restore.push(
                () =>
                    ((globalThis as Record<string, unknown>)[name] = original),
            )
        }
        try {
            resizeWithStaleOuter(page)
            outerCatchesUp(page)
        } finally {
            for (const undo of restore) undo()
        }
        expect(scheduled).toEqual([])
        await Bun.sleep(30)
        // Only the immediate measurement: the late outer size waits for the next resize.
        expect(seen).toEqual([1040])

        unsub()
        app.dispose()
    })

    test("without requestAnimationFrame, resize alone still works", () => {
        const page = install({ animationFrames: "absent" })
        const app = store()
        const seen: number[] = []
        const unsub = app.sub(windowSizeAtom, () =>
            seen.push(app.get(windowSizeAtom).innerWidth),
        )

        page.setWindow({ innerWidth: 640 })
        page.fire("window", "resize")
        expect(seen).toEqual([640])

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })
})
