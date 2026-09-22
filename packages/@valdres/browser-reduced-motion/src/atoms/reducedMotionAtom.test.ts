import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import {
    installMediaHarness,
    type MediaHarness,
} from "../../test/setup/mediaHarness"
import { REDUCED_MOTION_MEDIA } from "../lib/reducedMotionSource"
import { prefersReducedMotionSelector } from "../selectors/prefersReducedMotionSelector"
import { reducedMotionAtom } from "./reducedMotionAtom"

const REDUCE = REDUCED_MOTION_MEDIA

let harness: MediaHarness | undefined
const install = (matches: boolean) => {
    harness = installMediaHarness({ [REDUCE]: matches })
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

describe("reducedMotionAtom", () => {
    test("reads the current preference without subscribing to anything", () => {
        const media = install(true)
        const app = store()

        expect(app.get(reducedMotionAtom)).toBe("reduce")
        expect(app.get(prefersReducedMotionSelector)).toBe(true)
        expect(media.listeners(REDUCE)).toBe(0)

        app.dispose()
    })

    test("repeated reads reuse one MediaQueryList and never attach", () => {
        const media = install(false)
        const app = store()

        for (let i = 0; i < 10; i++)
            expect(app.get(reducedMotionAtom)).toBe("no-preference")
        expect(app.get(prefersReducedMotionSelector)).toBe(false)

        expect(media.created(REDUCE)).toBe(1)
        expect(media.listeners(REDUCE)).toBe(0)

        app.dispose()
    })

    test("a direct subscriber attaches exactly one listener and sees changes", () => {
        const media = install(false)
        const app = store()
        const seen: string[] = []

        const unsub = app.sub(reducedMotionAtom, () => seen.push(app.get(reducedMotionAtom)))
        expect(media.listeners(REDUCE)).toBe(1)

        media.set(REDUCE, true)
        media.change(REDUCE)
        expect(seen).toEqual(["reduce"])
        expect(app.get(reducedMotionAtom)).toBe("reduce")

        media.set(REDUCE, false)
        media.change(REDUCE)
        expect(seen).toEqual(["reduce", "no-preference"])

        unsub()
        expect(media.listeners(REDUCE)).toBe(0)
        app.dispose()
    })

    test("a transitive selector subscriber retains the source", () => {
        const media = install(false)
        const app = store()
        const seen: boolean[] = []

        const unsub = app.sub(prefersReducedMotionSelector, () => seen.push(app.get(prefersReducedMotionSelector)))
        expect(media.listeners(REDUCE)).toBe(1)

        media.set(REDUCE, true)
        media.change(REDUCE)
        expect(seen).toEqual([true])

        unsub()
        expect(media.listeners(REDUCE)).toBe(0)
        app.dispose()
    })

    test("an unchanged event settles without notifying selector subscribers", () => {
        const media = install(false)
        const app = store()
        let notifications = 0

        const unsub = app.sub(prefersReducedMotionSelector, () => notifications++)
        media.change(REDUCE) // spurious event, matches unchanged
        expect(notifications).toBe(0)
        expect(app.get(prefersReducedMotionSelector)).toBe(false)

        unsub()
        app.dispose()
    })

    test("two independent stores each own a physical listener", () => {
        const media = install(false)
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(reducedMotionAtom, () => seen.push("first"))
        const stopSecond = second.sub(reducedMotionAtom, () => seen.push("second"))
        expect(media.listeners(REDUCE)).toBe(2)

        media.set(REDUCE, true)
        media.change(REDUCE)
        expect(seen.sort()).toEqual(["first", "second"])
        expect(first.get(reducedMotionAtom)).toBe("reduce")
        expect(second.get(reducedMotionAtom)).toBe("reduce")

        // Two stores registered two DISTINCT listener functions, not one
        // invalidator attached twice.
        expect(media.attachCalls(REDUCE)).toBe(2)

        stopFirst()
        expect(media.listeners(REDUCE)).toBe(1)

        // The surviving store keeps receiving events after the other detaches.
        seen.length = 0
        media.set(REDUCE, false)
        media.change(REDUCE)
        expect(seen).toEqual(["second"])
        expect(second.get(reducedMotionAtom)).toBe("no-preference")

        stopSecond()
        expect(media.listeners(REDUCE)).toBe(0)

        first.dispose()
        second.dispose()
    })

    test("a dormant read observes a preference change the host never announced", () => {
        const media = install(false)
        const app = store()

        expect(app.get(reducedMotionAtom)).toBe("no-preference")
        expect(media.listeners(REDUCE)).toBe(0)

        // No event, no subscription: the preference simply is something else now.
        media.set(REDUCE, true)
        expect(app.get(reducedMotionAtom)).toBe("reduce")
        expect(app.get(prefersReducedMotionSelector)).toBe(true)
        expect(media.listeners(REDUCE)).toBe(0)
        expect(media.created(REDUCE)).toBe(1)

        app.dispose()
    })

    test("a child scope shares the tree projection instead of attaching again", () => {
        const media = install(true)
        const app = store()
        const child = app.scope()

        const stopRoot = app.sub(reducedMotionAtom, () => {})
        expect(media.listeners(REDUCE)).toBe(1)

        const stopChild = child.sub(reducedMotionAtom, () => {})
        expect(media.listeners(REDUCE)).toBe(1)
        expect(child.get(reducedMotionAtom)).toBe("reduce")

        media.set(REDUCE, false)
        media.change(REDUCE)
        expect(child.get(reducedMotionAtom)).toBe("no-preference")

        stopChild()
        stopRoot()
        expect(media.listeners(REDUCE)).toBe(0)

        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases the listener", () => {
        const media = install(false)
        const app = store()

        app.sub(reducedMotionAtom, () => {})
        expect(media.listeners(REDUCE)).toBe(1)

        app.dispose()
        expect(media.listeners(REDUCE)).toBe(0)
    })

    test("detach then reattach re-samples the preference that changed while dormant", () => {
        const media = install(false)
        const app = store()

        const first = app.sub(reducedMotionAtom, () => {})
        expect(media.listeners(REDUCE)).toBe(1)
        first()
        expect(media.listeners(REDUCE)).toBe(0)

        // The preference flips while nothing is attached.
        media.set(REDUCE, true)

        const second = app.sub(reducedMotionAtom, () => {})
        expect(media.listeners(REDUCE)).toBe(1)
        expect(app.get(reducedMotionAtom)).toBe("reduce")

        second()
        expect(media.listeners(REDUCE)).toBe(0)
        expect(media.created(REDUCE)).toBe(1)
        app.dispose()
    })

    test("each store owns an independent listener, so one throwing subscriber cannot starve another", () => {
        const media = install(false)
        const failing = store()
        const healthy = store()
        let healthyRuns = 0

        const stopFailing = failing.sub(reducedMotionAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(reducedMotionAtom, () => {
            healthyRuns++
        })
        // Two stores, two physical listeners: delivery is the platform's
        // per-listener dispatch, not a package-owned fan-out that could abort.
        expect(media.listeners(REDUCE)).toBe(2)

        media.set(REDUCE, true)
        const reported = media.changeReportingErrors(REDUCE)

        // Every registered store observed the change ...
        expect(healthyRuns).toBe(1)
        expect(healthy.get(reducedMotionAtom)).toBe("reduce")
        expect(failing.get(reducedMotionAtom)).toBe("reduce")
        // ... and the failing store's invalidation surfaced its failure rather
        // than swallowing it or inventing a new error type.
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")
        expect(
            String((reported[0] as { causes?: unknown[] }).causes?.[0]),
        ).toContain("subscriber exploded")

        stopFailing()
        stopHealthy()
        failing.dispose()
        healthy.dispose()
    })

    test("the source is read-only browser truth", () => {
        install(false)
        const app = store()

        expect(() =>
            (app as unknown as { set: (...args: unknown[]) => void }).set(
                reducedMotionAtom,
                "reduce",
            ),
        ).toThrow(TypeError)
        expect(() =>
            (app as unknown as { reset: (...args: unknown[]) => void }).reset(
                reducedMotionAtom,
            ),
        ).toThrow(TypeError)
        expect(() =>
            (app as unknown as { update: (...args: unknown[]) => void }).update(
                reducedMotionAtom,
                () => "reduce",
            ),
        ).toThrow(TypeError)
        expect(app.get(reducedMotionAtom)).toBe("no-preference")

        app.dispose()
    })

    test("falls back to no-preference and attaches nothing when matchMedia is missing", async () => {
        const { resetMediaQueryCache } = await import("../lib/mediaQuery")
        const native = window.matchMedia
        delete (window as { matchMedia?: unknown }).matchMedia
        resetMediaQueryCache()
        try {
            const app = store()
            expect(app.get(reducedMotionAtom)).toBe("no-preference")

            const unsub = app.sub(reducedMotionAtom, () => {})
            expect(app.get(reducedMotionAtom)).toBe("no-preference")
            expect(() => unsub()).not.toThrow()

            app.dispose()
        } finally {
            window.matchMedia = native
            resetMediaQueryCache()
        }
    })
})
