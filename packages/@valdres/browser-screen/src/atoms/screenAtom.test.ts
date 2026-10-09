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
import { SCREEN_UNAVAILABLE, screenSource } from "../lib/screenSource"
import type { ScreenInfo } from "../types/ScreenInfo"
import { screenAtom } from "./screenAtom"

let harness: GeometryHarness | undefined
const install = (options?: Parameters<typeof installGeometryHarness>[0]) => {
    harness = installGeometryHarness(options)
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

const ALL_ATTACHED = {
    "window:resize": 1,
    "screen:change": 1,
    "orientation:change": 1,
    "resolution:change": 1,
}

const ratioSelector = selector(get => get(screenAtom).devicePixelRatio, {
    name: "test/devicePixelRatio",
})

const thrown = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("screenAtom", () => {
    test("a dormant read samples the screen without attaching or matching media", () => {
        const page = install()
        const app = store()

        expect(app.get(screenAtom)).toEqual({
            width: 1920,
            height: 1080,
            availWidth: 1920,
            availHeight: 1050,
            colorDepth: 24,
            pixelDepth: 24,
            devicePixelRatio: 1,
            orientationType: "landscape-primary",
            orientationAngle: 0,
        })
        expect(page.physical()).toBe(0)
        expect(page.resolutionQueries()).toEqual([])

        app.dispose()
    })

    test("an unchanged reading is the same frozen object, for every store", () => {
        install()
        const first = store()
        const second = store()

        const snapshot = first.get(screenAtom)
        expect(Object.isFrozen(snapshot)).toBe(true)
        expect(first.get(screenAtom)).toBe(snapshot)
        expect(second.get(screenAtom)).toBe(snapshot)
        expect(screenSource.getSnapshot()).toBe(snapshot)

        first.dispose()
        second.dispose()
    })

    test("a dormant read observes a change the host never announced", () => {
        const page = install()
        const app = store()
        const before = app.get(screenAtom)

        page.setDevicePixelRatio(2)
        const after = app.get(screenAtom)
        expect(after).not.toBe(before)
        expect(after.devicePixelRatio).toBe(2)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a subscriber attaches one listener per kind of change", () => {
        const page = install()
        const app = store()

        const unsub = app.sub(screenAtom, () => {})
        expect(page.attached()).toEqual(ALL_ATTACHED)
        expect(page.resolutionQueries()).toEqual(["(resolution: 1dppx)"])

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("resize, orientation, screen and resolution changes each publish", () => {
        const page = install()
        const app = store()
        const seen: Partial<ScreenInfo>[] = []
        const unsub = app.sub(screenAtom, () => {
            const { width, availHeight, orientationAngle, devicePixelRatio } =
                app.get(screenAtom)
            seen.push({
                width,
                availHeight,
                orientationAngle,
                devicePixelRatio,
            })
        })

        page.setScreen({ width: 2560 })
        page.fire("window", "resize")
        page.setOrientation("landscape-secondary", 180)
        page.fire("orientation", "change")
        page.setScreen({ availHeight: 1000 })
        page.fire("screen", "change")
        expect(page.changeResolution(2)).toEqual([])

        expect(seen).toEqual([
            {
                width: 2560,
                availHeight: 1050,
                orientationAngle: 0,
                devicePixelRatio: 1,
            },
            {
                width: 2560,
                availHeight: 1050,
                orientationAngle: 180,
                devicePixelRatio: 1,
            },
            {
                width: 2560,
                availHeight: 1000,
                orientationAngle: 180,
                devicePixelRatio: 1,
            },
            {
                width: 2560,
                availHeight: 1000,
                orientationAngle: 180,
                devicePixelRatio: 2,
            },
        ])
        expect(app.get(screenAtom).orientationType).toBe("landscape-secondary")

        unsub()
        app.dispose()
    })

    test("the resolution watch follows the ratio, holding one listener", () => {
        const page = install()
        const app = store()
        const ratios: number[] = []
        const unsub = app.sub(ratioSelector, () =>
            ratios.push(app.get(ratioSelector)),
        )

        page.changeResolution(2)
        page.changeResolution(3)
        page.changeResolution(1.25)
        expect(ratios).toEqual([2, 3, 1.25])
        expect(page.resolutionQueries()).toEqual([
            "(resolution: 1dppx)",
            "(resolution: 2dppx)",
            "(resolution: 3dppx)",
            "(resolution: 1.25dppx)",
        ])
        expect(page.listeners("resolution", "change")).toBe(1)

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("a rotation is one coherent publication, whichever event arrives first", () => {
        const page = install()
        const app = store()
        const computed: string[] = []
        const shape = selector(get => {
            const info = get(screenAtom)
            const text = `${info.width}x${info.height}/${info.availWidth}x${info.availHeight} ${info.orientationType}@${info.orientationAngle}`
            computed.push(text)
            return text
        })
        let notifications = 0
        const unsub = app.sub(shape, () => notifications++)
        computed.length = 0

        // A rotation moves every field before either event fires.
        page.setScreen({
            width: 1080,
            height: 1920,
            availWidth: 1080,
            availHeight: 1890,
        })
        page.setOrientation("portrait-primary", 90)
        page.fire("window", "resize")
        page.fire("orientation", "change")

        expect(computed).toEqual(["1080x1920/1080x1890 portrait-primary@90"])
        expect(notifications).toBe(1)

        unsub()
        app.dispose()
    })

    test("an event that changes nothing notifies nobody and keeps the snapshot", () => {
        const page = install()
        const app = store()
        let notifications = 0
        const unsub = app.sub(screenAtom, () => notifications++)
        const before = app.get(screenAtom)

        page.fire("window", "resize")
        page.fire("orientation", "change")
        page.fire("screen", "change")
        expect(notifications).toBe(0)
        expect(app.get(screenAtom)).toBe(before)

        unsub()
        app.dispose()
    })

    test("a selector below the source suppresses changes that do not move it", () => {
        const page = install()
        const app = store()
        let atomRuns = 0
        let ratioRuns = 0
        const stopAtom = app.sub(screenAtom, () => atomRuns++)
        const stopRatio = app.sub(ratioSelector, () => ratioRuns++)

        page.setScreen({ availHeight: 1000 })
        page.fire("window", "resize")
        expect({ atomRuns, ratioRuns }).toEqual({ atomRuns: 1, ratioRuns: 0 })

        page.changeResolution(2)
        expect({ atomRuns, ratioRuns }).toEqual({ atomRuns: 2, ratioRuns: 1 })

        stopRatio()
        stopAtom()
        app.dispose()
    })

    test("a settle handler sees the whole reading in the same update", () => {
        const page = install()
        const app = store()
        const layout: Atom<string> = atom("unknown")
        const stop = app.sub(screenAtom, {
            settle: tx => {
                const info = tx.get(screenAtom)
                tx.set(
                    layout,
                    `${info.orientationType}:${info.width}x${info.height}`,
                )
            },
        })

        page.setScreen({ width: 1080, height: 1920 })
        page.setOrientation("portrait-primary", 90)
        page.fire("orientation", "change")
        expect(app.get(layout)).toBe("portrait-primary:1080x1920")

        stop()
        app.dispose()
    })

    test("two independent stores each own their listeners", () => {
        const page = install()
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(screenAtom, () => seen.push("first"))
        const stopSecond = second.sub(screenAtom, () => seen.push("second"))
        expect(page.attached()).toEqual({
            "window:resize": 2,
            "screen:change": 2,
            "orientation:change": 2,
            "resolution:change": 2,
        })

        page.changeResolution(2)
        expect(seen.sort()).toEqual(["first", "second"])
        expect(first.get(screenAtom)).toBe(second.get(screenAtom))

        stopFirst()
        expect(page.attached()).toEqual(ALL_ATTACHED)

        seen.length = 0
        page.changeResolution(1)
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

        const stopRoot = app.sub(screenAtom, () => {})
        const stopChild = child.sub(ratioSelector, () => {})
        expect(page.attached()).toEqual(ALL_ATTACHED)

        page.changeResolution(2)
        expect(child.get(ratioSelector)).toBe(2)

        stopRoot()
        expect(page.attached()).toEqual(ALL_ATTACHED)
        stopChild()
        expect(page.physical()).toBe(0)
        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases every listener", () => {
        const page = install()
        const app = store()
        app.scope("panel").sub(screenAtom, () => {})
        app.sub(ratioSelector, () => {})
        page.changeResolution(2)
        expect(page.attached()).toEqual(ALL_ATTACHED)

        app.dispose()
        expect(page.physical()).toBe(0)
    })

    test("detach then reattach re-samples and watches the current ratio", () => {
        const page = install()
        const app = store()

        app.sub(screenAtom, () => {})()
        page.setDevicePixelRatio(2)
        page.setScreen({ width: 3840 })

        const ratios: number[] = []
        const stop = app.sub(ratioSelector, () =>
            ratios.push(app.get(ratioSelector)),
        )
        expect(app.get(screenAtom).width).toBe(3840)
        expect(app.get(ratioSelector)).toBe(2)
        expect(page.resolutionQueries().at(-1)).toBe("(resolution: 2dppx)")

        page.changeResolution(1)
        expect(ratios).toEqual([1])

        stop()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("one throwing subscriber cannot starve another store or strand its own watch", () => {
        const page = install()
        const failing = store()
        const healthy = store()
        let healthyRuns = 0
        const stopFailing = failing.sub(screenAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(screenAtom, () => healthyRuns++)

        const reported = page.changeResolution(2)
        expect(healthyRuns).toBe(1)
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")
        expect(failing.get(screenAtom).devicePixelRatio).toBe(2)

        // The failing store's watch moved before it was told.
        expect(page.listeners("resolution", "change")).toBe(2)
        expect(page.changeResolution(3)).toHaveLength(1)
        expect(failing.get(screenAtom).devicePixelRatio).toBe(3)
        expect(healthyRuns).toBe(2)

        stopFailing()
        stopHealthy()
        expect(page.physical()).toBe(0)
        failing.dispose()
        healthy.dispose()
    })

    test("unsubscribing from inside a resolution delivery leaves no watch behind", () => {
        const page = install()
        const app = store()
        let stop = () => {}
        stop = app.sub(screenAtom, () => stop())

        expect(page.changeResolution(2)).toEqual([])
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a delivery that arrives after release does nothing", () => {
        // A conforming host never invokes a removed listener; one that
        // dispatches from a stale listener list must not re-arm the watch.
        const page = install()
        const app = store()
        const stop = app.sub(screenAtom, () => {})
        const [stale] = page.snapshotListeners("resolution", "change")
        stop()

        page.setDevicePixelRatio(2)
        ;(stale as () => void)()
        expect(page.resolutionQueries()).toEqual(["(resolution: 1dppx)"])
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    describe("attachment failures", () => {
        for (const [target, type] of [
            ["orientation", "change"],
            ["screen", "change"],
            ["resolution", "change"],
        ] as const) {
            test(`a failing ${target} ${type} attachment releases everything already installed`, () => {
                const page = install()
                const app = store()
                const boom = new Error(`${target} rejected`)
                page.failOnAttach(target, type, boom)

                const error = thrown(() => app.sub(screenAtom, () => {}))
                expect(error).toBeInstanceOf(ExternalSourceOperationError)
                expect((error as ExternalSourceOperationError).cause).toBe(boom)
                expect(page.attachCalls("window", "resize")).toBe(1)
                expect(page.physical()).toBe(0)

                page.failOnAttach(target, type, undefined)
                const stop = app.sub(screenAtom, () => {})
                expect(page.attached()).toEqual(ALL_ATTACHED)
                stop()
                app.dispose()
            })
        }

        test("a throwing matchMedia releases everything already installed", () => {
            const page = install()
            const app = store()
            const boom = new Error("matchMedia rejected")
            page.failMatchMedia(boom)

            const error = thrown(() => app.sub(screenAtom, () => {}))
            expect((error as ExternalSourceOperationError).cause).toBe(boom)
            expect(page.physical()).toBe(0)

            page.failMatchMedia(undefined)
            app.dispose()
        })
    })

    describe("cleanup failures", () => {
        test("one failing removal still releases the other listeners", () => {
            const page = install()
            const app = store()
            const stop = app.sub(screenAtom, () => {})
            const boom = new Error("orientation removal rejected")
            page.failOnDetach("orientation", "change", boom)

            const error = thrown(stop)
            expect(error).toBeInstanceOf(ExternalSourceOperationError)
            expect(error).toMatchObject({ cause: boom, phase: "cleanup" })
            // Only the listener the host refused to remove is left.
            expect(page.attached()).toEqual({ "orientation:change": 1 })

            page.failOnDetach("orientation", "change", undefined)
            app.dispose()
        })

        test("several failing removals are reported together", () => {
            const page = install()
            const app = store()
            const stop = app.sub(screenAtom, () => {})
            const first = new Error("resize removal rejected")
            const second = new Error("resolution removal rejected")
            page.failOnDetach("window", "resize", first)
            page.failOnDetach("resolution", "change", second)

            const error = thrown(stop) as ExternalSourceOperationError
            expect(error.cause).toBeInstanceOf(AggregateError)
            expect((error.cause as AggregateError).errors).toEqual([
                first,
                second,
            ])
            expect(page.attached()).toEqual({
                "window:resize": 1,
                "resolution:change": 1,
            })

            page.failOnDetach("window", "resize", undefined)
            page.failOnDetach("resolution", "change", undefined)
            app.dispose()
        })
    })

    describe("delivery failures", () => {
        test("a failing re-watch still publishes the new ratio, then reports", () => {
            const page = install()
            const app = store()
            const ratios: number[] = []
            const stop = app.sub(ratioSelector, () =>
                ratios.push(app.get(ratioSelector)),
            )
            const boom = new Error("matchMedia rejected")
            page.failMatchMedia(boom)

            expect(page.changeResolution(2)).toEqual([boom])
            expect(ratios).toEqual([2])
            // The old watch is kept rather than lost, and resize still works.
            expect(page.listeners("resolution", "change")).toBe(1)
            page.failMatchMedia(undefined)
            page.setDevicePixelRatio(3)
            page.fire("window", "resize")
            expect(ratios).toEqual([2, 3])

            stop()
            expect(page.physical()).toBe(0)
            app.dispose()
        })

        test("a failing re-watch and a failing subscriber are reported together", () => {
            const page = install()
            const app = store()
            const stop = app.sub(screenAtom, () => {
                throw new Error("subscriber exploded")
            })
            const boom = new Error("matchMedia rejected")
            page.failMatchMedia(boom)

            const reported = page.changeResolution(2)
            expect(reported).toHaveLength(1)
            const aggregate = reported[0] as AggregateError
            expect(aggregate).toBeInstanceOf(AggregateError)
            expect(aggregate.errors[0]).toBe(boom)
            expect((aggregate.errors[1] as Error).name).toBe(
                "SubscriberNotificationError",
            )
            expect(app.get(screenAtom).devicePixelRatio).toBe(2)

            page.failMatchMedia(undefined)
            stop()
            app.dispose()
        })
    })

    test("without Screen Orientation, screen events or matchMedia, resize still works", () => {
        const page = install({ orientation: false, screenEvents: false })
        const matchMedia = window.matchMedia
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            value: undefined,
        })
        try {
            const app = store()
            const seen: ScreenInfo[] = []
            const stop = app.sub(screenAtom, () =>
                seen.push(app.get(screenAtom)),
            )
            expect(page.attached()).toEqual({ "window:resize": 1 })
            expect(app.get(screenAtom)).toMatchObject({
                orientationType: "landscape-primary",
                orientationAngle: 0,
            })

            page.setDevicePixelRatio(2)
            page.fire("window", "resize")
            expect(seen.map(info => info.devicePixelRatio)).toEqual([2])

            stop()
            expect(page.physical()).toBe(0)
            app.dispose()
        } finally {
            Object.defineProperty(window, "matchMedia", {
                configurable: true,
                writable: true,
                value: matchMedia,
            })
        }
    })

    test("an unknown orientation type reads as the default", () => {
        const page = install()
        page.setOrientation("upside-down" as OrientationType, 270)
        const app = store()
        expect(app.get(screenAtom)).toMatchObject({
            orientationType: "landscape-primary",
            orientationAngle: 270,
        })
        app.dispose()
    })

    test("the source is read-only browser truth", () => {
        install()
        const app = store()
        const loose = app as unknown as Record<
            "set" | "reset" | "update",
            (...args: unknown[]) => void
        >
        expect(() => loose.set(screenAtom, SCREEN_UNAVAILABLE)).toThrow(
            TypeError,
        )
        expect(() => loose.reset(screenAtom)).toThrow(TypeError)
        expect(() =>
            loose.update(screenAtom, (info: ScreenInfo) => info),
        ).toThrow(TypeError)
        expect(() => loose.set(ratioSelector, 3)).toThrow(TypeError)
        expect(app.get(screenAtom).width).toBe(1920)
        app.dispose()
    })

    test("an app-owned override stays local to the store that set it", () => {
        const page = install()
        const forcedRatio = atom<number | null>(null)
        const renderRatio = selector(
            get => get(forcedRatio) ?? get(screenAtom).devicePixelRatio,
        )
        const first = store()
        const second = store()
        first.set(forcedRatio, 3)

        const stop = second.sub(renderRatio, () => {})
        page.changeResolution(2)
        expect(first.get(renderRatio)).toBe(3)
        expect(second.get(renderRatio)).toBe(2)

        stop()
        first.dispose()
        second.dispose()
    })

    test("the server snapshot is a fixed frozen seed, whatever the live screen", () => {
        install()
        expect(screenSource.getServerSnapshot?.()).toBe(SCREEN_UNAVAILABLE)
        expect(SCREEN_UNAVAILABLE).toEqual({
            width: 0,
            height: 0,
            availWidth: 0,
            availHeight: 0,
            colorDepth: 24,
            pixelDepth: 24,
            devicePixelRatio: 1,
            orientationType: "landscape-primary",
            orientationAngle: 0,
        })
        expect(Object.isFrozen(SCREEN_UNAVAILABLE)).toBe(true)
    })
})
