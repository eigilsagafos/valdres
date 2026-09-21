import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import {
    installMediaHarness,
    type MediaHarness,
} from "../../test/setup/mediaHarness"
import { COLOR_SCHEME_MEDIA } from "../lib/colorSchemeSource"
import { isDarkSelector } from "../selectors/isDarkSelector"
import { isLightSelector } from "../selectors/isLightSelector"
import { colorSchemeAtom } from "./colorSchemeAtom"

const DARK = COLOR_SCHEME_MEDIA

let harness: MediaHarness | undefined
const install = (matches: boolean) => {
    harness = installMediaHarness({ [DARK]: matches })
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

describe("colorSchemeAtom", () => {
    test("reads the current preference without subscribing to anything", () => {
        const media = install(true)
        const app = store()

        expect(app.get(colorSchemeAtom)).toBe("dark")
        expect(media.listeners(DARK)).toBe(0)

        app.dispose()
    })

    test("repeated reads reuse one MediaQueryList and never attach", () => {
        const media = install(false)
        const app = store()

        for (let i = 0; i < 10; i++) expect(app.get(colorSchemeAtom)).toBe("light")
        expect(app.get(isDarkSelector)).toBe(false)
        expect(app.get(isLightSelector)).toBe(true)

        expect(media.created(DARK)).toBe(1)
        expect(media.listeners(DARK)).toBe(0)

        app.dispose()
    })

    test("a direct subscriber attaches exactly one listener and sees changes", () => {
        const media = install(false)
        const app = store()
        const seen: string[] = []

        const unsub = app.sub(colorSchemeAtom, () =>
            seen.push(app.get(colorSchemeAtom)),
        )
        expect(media.listeners(DARK)).toBe(1)

        media.set(DARK, true)
        media.change(DARK)
        expect(seen).toEqual(["dark"])
        expect(app.get(colorSchemeAtom)).toBe("dark")

        media.set(DARK, false)
        media.change(DARK)
        expect(seen).toEqual(["dark", "light"])

        unsub()
        expect(media.listeners(DARK)).toBe(0)
        app.dispose()
    })

    test("a transitive selector subscriber retains the source", () => {
        const media = install(false)
        const app = store()
        const seen: boolean[] = []

        const unsub = app.sub(isDarkSelector, () =>
            seen.push(app.get(isDarkSelector)),
        )
        expect(media.listeners(DARK)).toBe(1)

        media.set(DARK, true)
        media.change(DARK)
        expect(seen).toEqual([true])
        expect(app.get(isLightSelector)).toBe(false)

        unsub()
        expect(media.listeners(DARK)).toBe(0)
        app.dispose()
    })

    test("an unchanged event settles without notifying selector subscribers", () => {
        const media = install(false)
        const app = store()
        let notifications = 0

        const unsub = app.sub(isDarkSelector, () => notifications++)
        media.change(DARK) // spurious event, matches unchanged
        expect(notifications).toBe(0)
        expect(app.get(isDarkSelector)).toBe(false)

        unsub()
        app.dispose()
    })

    test("two independent stores each own a physical listener", () => {
        const media = install(false)
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(colorSchemeAtom, () => seen.push("first"))
        const stopSecond = second.sub(colorSchemeAtom, () => seen.push("second"))
        expect(media.listeners(DARK)).toBe(2)

        media.set(DARK, true)
        media.change(DARK)
        expect(seen.sort()).toEqual(["first", "second"])
        expect(first.get(colorSchemeAtom)).toBe("dark")
        expect(second.get(colorSchemeAtom)).toBe("dark")

        stopFirst()
        expect(media.listeners(DARK)).toBe(1)
        stopSecond()
        expect(media.listeners(DARK)).toBe(0)

        first.dispose()
        second.dispose()
    })

    test("a child scope shares the tree projection instead of attaching again", () => {
        const media = install(true)
        const app = store()
        const child = app.scope()

        const stopRoot = app.sub(colorSchemeAtom, () => {})
        expect(media.listeners(DARK)).toBe(1)

        const stopChild = child.sub(colorSchemeAtom, () => {})
        expect(media.listeners(DARK)).toBe(1)
        expect(child.get(colorSchemeAtom)).toBe("dark")

        media.set(DARK, false)
        media.change(DARK)
        expect(child.get(colorSchemeAtom)).toBe("light")

        stopChild()
        stopRoot()
        expect(media.listeners(DARK)).toBe(0)

        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases the listener", () => {
        const media = install(false)
        const app = store()

        app.sub(colorSchemeAtom, () => {})
        expect(media.listeners(DARK)).toBe(1)

        app.dispose()
        expect(media.listeners(DARK)).toBe(0)
    })

    test("detach then reattach re-samples the preference that changed while dormant", () => {
        const media = install(false)
        const app = store()

        const first = app.sub(colorSchemeAtom, () => {})
        expect(media.listeners(DARK)).toBe(1)
        first()
        expect(media.listeners(DARK)).toBe(0)

        // The OS flips while nothing is attached.
        media.set(DARK, true)

        const second = app.sub(colorSchemeAtom, () => {})
        expect(media.listeners(DARK)).toBe(1)
        expect(app.get(colorSchemeAtom)).toBe("dark")

        second()
        expect(media.listeners(DARK)).toBe(0)
        expect(media.created(DARK)).toBe(1)
        app.dispose()
    })

    test("each store owns an independent listener, so one throwing subscriber cannot starve another", () => {
        const media = install(false)
        const failing = store()
        const healthy = store()
        let healthyRuns = 0

        const stopFailing = failing.sub(colorSchemeAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(colorSchemeAtom, () => {
            healthyRuns++
        })
        // Two stores, two physical listeners: delivery is the platform's
        // per-listener dispatch, not a package-owned fan-out that could abort.
        expect(media.listeners(DARK)).toBe(2)

        media.set(DARK, true)
        const reported = media.changeReportingErrors(DARK)

        // Every registered store observed the change ...
        expect(healthyRuns).toBe(1)
        expect(healthy.get(colorSchemeAtom)).toBe("dark")
        expect(failing.get(colorSchemeAtom)).toBe("dark")
        // ... and the failing store's invalidation surfaced its failure rather
        // than swallowing it or inventing a new error type.
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")
        expect(String((reported[0] as { causes?: unknown[] }).causes?.[0])).toContain(
            "subscriber exploded",
        )

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
                colorSchemeAtom,
                "dark",
            ),
        ).toThrow(TypeError)
        expect(() =>
            (app as unknown as { reset: (...args: unknown[]) => void }).reset(
                colorSchemeAtom,
            ),
        ).toThrow(TypeError)
        expect(app.get(colorSchemeAtom)).toBe("light")

        app.dispose()
    })

    test("falls back to light and attaches nothing when matchMedia is missing", async () => {
        const { resetMediaQueryCache } = await import("../lib/mediaQuery")
        const native = window.matchMedia
        delete (window as { matchMedia?: unknown }).matchMedia
        resetMediaQueryCache()
        try {
            const app = store()
            expect(app.get(colorSchemeAtom)).toBe("light")

            const unsub = app.sub(colorSchemeAtom, () => {})
            expect(app.get(colorSchemeAtom)).toBe("light")
            expect(() => unsub()).not.toThrow()

            app.dispose()
        } finally {
            window.matchMedia = native
            resetMediaQueryCache()
        }
    })
})
