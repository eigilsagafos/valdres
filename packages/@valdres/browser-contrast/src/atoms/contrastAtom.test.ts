import { afterEach, describe, expect, test } from "bun:test"
import { ExternalSourceOperationError, store } from "valdres"
import {
    installMediaHarness,
    type MediaHarness,
} from "../../test/setup/mediaHarness"
import { CONTRAST_QUERIES } from "../lib/contrastSource"
import { prefersLessContrastSelector } from "../selectors/prefersLessContrastSelector"
import { prefersMoreContrastSelector } from "../selectors/prefersMoreContrastSelector"
import { contrastAtom } from "./contrastAtom"

const MORE = CONTRAST_QUERIES[0]!.query
const LESS = CONTRAST_QUERIES[1]!.query
const CUSTOM = CONTRAST_QUERIES[2]!.query
const ALL = [MORE, LESS, CUSTOM]

const totalListeners = (media: MediaHarness) =>
    ALL.reduce((sum, query) => sum + media.listeners(query), 0)

let harness: MediaHarness | undefined
const install = (matching: Readonly<Record<string, boolean>> = {}) => {
    harness = installMediaHarness(matching)
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
})

describe("contrastAtom", () => {
    test("reports no-preference when nothing matches, without subscribing", () => {
        const media = install()
        const app = store()

        expect(app.get(contrastAtom)).toBe("no-preference")
        expect(totalListeners(media)).toBe(0)

        app.dispose()
    })

    test("keeps the published more > less > custom precedence", () => {
        const media = install({ [MORE]: true, [LESS]: true, [CUSTOM]: true })
        const app = store()
        expect(app.get(contrastAtom)).toBe("more")

        media.set(MORE, false)
        expect(app.get(contrastAtom)).toBe("less")

        media.set(LESS, false)
        expect(app.get(contrastAtom)).toBe("custom")

        media.set(CUSTOM, false)
        expect(app.get(contrastAtom)).toBe("no-preference")

        app.dispose()
    })

    test("repeated reads reuse one MediaQueryList per query and never attach", () => {
        const media = install({ [CUSTOM]: true })
        const app = store()

        for (let i = 0; i < 10; i++) expect(app.get(contrastAtom)).toBe("custom")
        expect(app.get(prefersMoreContrastSelector)).toBe(false)
        expect(app.get(prefersLessContrastSelector)).toBe(false)

        for (const query of ALL) expect(media.created(query)).toBe(1)
        expect(totalListeners(media)).toBe(0)

        app.dispose()
    })

    test("a subscriber attaches one listener per query and sees changes on any of them", () => {
        const media = install()
        const app = store()
        const seen: string[] = []

        const unsub = app.sub(contrastAtom, () => seen.push(app.get(contrastAtom)))
        for (const query of ALL) expect(media.listeners(query)).toBe(1)

        media.set(LESS, true)
        media.change(LESS)
        expect(seen).toEqual(["less"])

        // A higher-precedence query starting to match wins, and its own event
        // is what delivers the change.
        media.set(MORE, true)
        media.change(MORE)
        expect(seen).toEqual(["less", "more"])

        unsub()
        expect(totalListeners(media)).toBe(0)
        app.dispose()
    })

    test("a transitive selector subscriber retains the source", () => {
        const media = install()
        const app = store()
        const seen: boolean[] = []

        const unsub = app.sub(prefersMoreContrastSelector, () =>
            seen.push(app.get(prefersMoreContrastSelector)),
        )
        expect(totalListeners(media)).toBe(3)

        media.set(MORE, true)
        media.change(MORE)
        expect(seen).toEqual([true])
        expect(app.get(prefersLessContrastSelector)).toBe(false)

        unsub()
        expect(totalListeners(media)).toBe(0)
        app.dispose()
    })

    test("an event that does not change the resolved value notifies nobody", () => {
        const media = install({ [MORE]: true })
        const app = store()
        let notifications = 0

        const unsub = app.sub(contrastAtom, () => notifications++)
        // `custom` starts matching, but `more` still wins.
        media.set(CUSTOM, true)
        media.change(CUSTOM)
        expect(notifications).toBe(0)
        expect(app.get(contrastAtom)).toBe("more")

        unsub()
        app.dispose()
    })

    test("two independent stores each own a full set of listeners", () => {
        const media = install()
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(contrastAtom, () => seen.push("first"))
        const stopSecond = second.sub(contrastAtom, () => seen.push("second"))
        for (const query of ALL) expect(media.listeners(query)).toBe(2)

        media.set(MORE, true)
        media.change(MORE)
        expect(seen.sort()).toEqual(["first", "second"])
        expect(first.get(contrastAtom)).toBe("more")
        expect(second.get(contrastAtom)).toBe("more")

        stopFirst()
        expect(totalListeners(media)).toBe(3)
        stopSecond()
        expect(totalListeners(media)).toBe(0)

        first.dispose()
        second.dispose()
    })

    test("a child scope shares the tree projection instead of attaching again", () => {
        const media = install({ [LESS]: true })
        const app = store()
        const child = app.scope()

        const stopRoot = app.sub(contrastAtom, () => {})
        expect(totalListeners(media)).toBe(3)

        const stopChild = child.sub(contrastAtom, () => {})
        expect(totalListeners(media)).toBe(3)
        expect(child.get(contrastAtom)).toBe("less")

        media.set(LESS, false)
        media.change(LESS)
        expect(child.get(contrastAtom)).toBe("no-preference")

        stopChild()
        stopRoot()
        expect(totalListeners(media)).toBe(0)

        child.dispose()
        app.dispose()
    })

    test("disposing a store with a live subscriber releases every listener", () => {
        const media = install()
        const app = store()

        app.sub(contrastAtom, () => {})
        expect(totalListeners(media)).toBe(3)

        app.dispose()
        expect(totalListeners(media)).toBe(0)
    })

    test("detach then reattach re-samples the preference that changed while dormant", () => {
        const media = install()
        const app = store()

        const first = app.sub(contrastAtom, () => {})
        expect(totalListeners(media)).toBe(3)
        first()
        expect(totalListeners(media)).toBe(0)

        media.set(CUSTOM, true)

        const second = app.sub(contrastAtom, () => {})
        expect(totalListeners(media)).toBe(3)
        expect(app.get(contrastAtom)).toBe("custom")

        second()
        expect(totalListeners(media)).toBe(0)
        for (const query of ALL) expect(media.created(query)).toBe(1)
        app.dispose()
    })

    test("a partial attachment failure releases the listeners it already installed", () => {
        const media = install()
        const app = store()
        const boom = new Error("addEventListener rejected")
        // The middle query refuses to attach; `more` is already attached by then.
        media.failOnAttach(LESS, boom)

        try {
            // The core wraps an arbitrary setup throw rather than mutating the
            // application's error object; the original is preserved as `cause`.
            let thrown: unknown
            try {
                app.sub(contrastAtom, () => {})
            } catch (error) {
                thrown = error
            }
            expect(thrown).toBeInstanceOf(ExternalSourceOperationError)
            expect((thrown as ExternalSourceOperationError).cause).toBe(boom)
            // `more` was attached and then released; nothing leaked.
            expect(totalListeners(media)).toBe(0)
        } finally {
            media.failOnAttach(LESS, undefined)
        }

        // The source is still usable afterwards.
        const unsub = app.sub(contrastAtom, () => {})
        expect(totalListeners(media)).toBe(3)
        unsub()
        expect(totalListeners(media)).toBe(0)
        app.dispose()
    })

    test("each store owns independent listeners, so one throwing subscriber cannot starve another", () => {
        const media = install()
        const failing = store()
        const healthy = store()
        let healthyRuns = 0

        const stopFailing = failing.sub(contrastAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(contrastAtom, () => {
            healthyRuns++
        })
        expect(media.listeners(MORE)).toBe(2)

        media.set(MORE, true)
        const reported = media.changeReportingErrors(MORE)

        expect(healthyRuns).toBe(1)
        expect(healthy.get(contrastAtom)).toBe("more")
        expect(failing.get(contrastAtom)).toBe("more")
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
        install()
        const app = store()

        expect(() =>
            (app as unknown as { set: (...args: unknown[]) => void }).set(
                contrastAtom,
                "more",
            ),
        ).toThrow(TypeError)
        expect(() =>
            (app as unknown as { reset: (...args: unknown[]) => void }).reset(
                contrastAtom,
            ),
        ).toThrow(TypeError)
        expect(app.get(contrastAtom)).toBe("no-preference")

        app.dispose()
    })

    test("falls back to no-preference and attaches nothing when matchMedia is missing", async () => {
        const { resetMediaQueryCache } = await import("../lib/mediaQuery")
        const native = window.matchMedia
        delete (window as { matchMedia?: unknown }).matchMedia
        resetMediaQueryCache()
        try {
            const app = store()
            expect(app.get(contrastAtom)).toBe("no-preference")

            const unsub = app.sub(contrastAtom, () => {})
            expect(app.get(contrastAtom)).toBe("no-preference")
            expect(() => unsub()).not.toThrow()

            app.dispose()
        } finally {
            window.matchMedia = native
            resetMediaQueryCache()
        }
    })
})
