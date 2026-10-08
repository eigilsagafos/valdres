import { afterEach, describe, expect, test } from "bun:test"
import { ExternalSourceOperationError, store } from "valdres"
import { installPageHarness, type PageHarness } from "../../test/setup/pageHarness"
import { peekFocusHub, resolveFocusHost } from "../lib/focusHubs"
import { FOCUS_UNAVAILABLE, focusSource } from "../lib/focusSource"
import { focusAtom } from "./focusAtom"

let harness: PageHarness | undefined
const install = (focused: boolean) => {
    harness = installPageHarness()
    harness.setHasFocus(focused)
    return harness
}

afterEach(() => {
    harness?.restore()
    harness = undefined
    // Every test releases what it retained; a leaked hub would leak state into
    // the next test, so fail loudly here rather than there.
    expect(peekFocusHub(resolveFocusHost()!)).toBeUndefined()
})

const hub = () => peekFocusHub(resolveFocusHost()!)
const listeners = (page: PageHarness) => ({
    focus: page.listeners("window", "focus"),
    blur: page.listeners("window", "blur"),
})

describe("focusAtom", () => {
    test("a dormant read samples document.hasFocus() without attaching", () => {
        const page = install(false)
        const app = store()

        expect(app.get(focusAtom)).toBe(false)
        expect(page.physical()).toBe(0)
        expect(hub()).toBeUndefined()

        app.dispose()
    })

    test("a dormant read observes a change the host never announced", () => {
        const page = install(true)
        const app = store()
        expect(app.get(focusAtom)).toBe(true)

        page.setHasFocus(false)
        expect(app.get(focusAtom)).toBe(false)
        expect(page.physical()).toBe(0)

        app.dispose()
    })

    test("a subscriber attaches one focus and one blur listener and follows them", () => {
        const page = install(true)
        const app = store()
        const seen: boolean[] = []

        const unsub = app.sub(focusAtom, () => seen.push(app.get(focusAtom)))
        expect(listeners(page)).toEqual({ focus: 1, blur: 1 })
        expect(hub()?.registrations()).toBe(1)

        page.setHasFocus(false)
        page.fire("window", "blur")
        page.setHasFocus(true)
        page.fire("window", "focus")
        expect(seen).toEqual([false, true])

        unsub()
        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("the retained value is what the window's events announced, not hasFocus()", () => {
        // Focus moving into a nested frame blurs this window while
        // `document.hasFocus()` keeps reporting true. The window-level meaning
        // follows the event, and stays consistent until the next one.
        const page = install(true)
        const app = store()
        const other = store()
        const unsub = app.sub(focusAtom, () => {})

        page.fire("window", "blur")
        expect(app.get(focusAtom)).toBe(false)
        // A dormant read in another store agrees with the retained value while
        // the hub is attached ...
        expect(other.get(focusAtom)).toBe(false)

        // ... and samples the platform again once nothing retains the source.
        unsub()
        expect(other.get(focusAtom)).toBe(true)

        other.dispose()
        app.dispose()
    })

    describe("focus delegated to a nested browsing context", () => {
        // Chromium 151, native input (see the browser-status focus probe):
        // focus entering an iframe blurs this window while hasFocus() stays
        // true and activeElement is the <iframe>. Samples must agree with that.
        const frames: Element[] = []
        const frame = (parent: ParentNode = document.body) => {
            const element = document.createElement("iframe")
            parent.append(element)
            frames.push(element)
            return element
        }
        afterEach(() => {
            for (const element of frames.splice(0)) element.remove()
            ;(document.activeElement as HTMLElement | null)?.blur?.()
        })

        test("a dormant read reports this window as blurred", () => {
            install(true)
            const app = store()
            frame().focus()
            expect(document.activeElement?.tagName).toBe("IFRAME")
            expect(document.hasFocus()).toBe(true)
            expect(app.get(focusAtom)).toBe(false)
            app.dispose()
        })

        test("a frame inside an open shadow root is followed", () => {
            install(true)
            const app = store()
            const host = document.createElement("div")
            document.body.append(host)
            frames.push(host)
            frame(host.attachShadow({ mode: "open" })).focus()
            expect(document.activeElement).toBe(host)
            expect(app.get(focusAtom)).toBe(false)
            app.dispose()
        })

        test("a host without activeElement samples hasFocus() alone", () => {
            install(false)
            const app = store()
            const own = Object.getOwnPropertyDescriptor(document, "activeElement")
            Object.defineProperty(document, "activeElement", {
                configurable: true,
                get: () => undefined,
            })
            try {
                expect(app.get(focusAtom)).toBe(false)
                harness!.setHasFocus(true)
                expect(app.get(focusAtom)).toBe(true)
            } finally {
                if (own) Object.defineProperty(document, "activeElement", own)
                else delete (document as { activeElement?: unknown }).activeElement
            }
            app.dispose()
        })

        test("attaching while a frame holds focus seeds false until the window's focus event", () => {
            const page = install(true)
            const app = store()
            const element = frame()
            element.focus()
            const seen: boolean[] = []
            const stop = app.sub(focusAtom, () => seen.push(app.get(focusAtom)))
            expect(app.get(focusAtom)).toBe(false)

            ;(element as HTMLElement).blur()
            page.fire("window", "focus")
            expect(seen).toEqual([true])

            stop()
            app.dispose()
        })
    })

    describe("documented delivery limits (not defects to fix here)", () => {
        // Pins what browser-focus.mdx says under "Delivery across stores". One
        // shared source value does not make committed reads atomic across
        // independent stores, and reentrant changes may coalesce. Changing
        // either is a core/dispatch design question, not a package fix.

        test("during delivery, a store can read its updated value next to another store's stale one", () => {
            const page = install(true)
            const a = store()
            const b = store()
            const trace: string[] = []
            const read = (reader: string) =>
                trace.push(`${reader}: a=${a.get(focusAtom)} b=${b.get(focusAtom)}`)
            const stopA = a.sub(focusAtom, () => read("A"))
            const stopB = b.sub(focusAtom, () => read("B"))

            page.fire("window", "blur")
            expect(trace).toEqual(["A: a=false b=true", "B: a=false b=false"])
            // After delivery completes, every store agrees.
            expect([a.get(focusAtom), b.get(focusAtom)]).toEqual([false, false])

            stopA()
            stopB()
            a.dispose()
            b.dispose()
        })

        test("a change caused during delivery may coalesce: not one notification per native event", () => {
            const page = install(true)
            const a = store()
            const b = store()
            const seenA: boolean[] = []
            const seenB: boolean[] = []
            const stopA = a.sub(focusAtom, () => {
                seenA.push(a.get(focusAtom))
                // A's subscriber moves focus straight back.
                if (!a.get(focusAtom)) page.fire("window", "focus")
            })
            const stopB = b.sub(focusAtom, () => seenB.push(b.get(focusAtom)))

            page.fire("window", "blur")
            expect(seenA).toEqual([false, true])
            // B's value ended where it started, so B was never notified.
            expect(seenB).toEqual([])
            // Every store settles on the final state.
            expect([a.get(focusAtom), b.get(focusAtom)]).toEqual([true, true])

            stopA()
            stopB()
            a.dispose()
            b.dispose()
        })
    })

    test("an event that does not change the state notifies nobody", () => {
        const page = install(true)
        const app = store()
        let notifications = 0
        const unsub = app.sub(focusAtom, () => notifications++)

        page.fire("window", "focus")
        expect(notifications).toBe(0)

        unsub()
        app.dispose()
    })

    test("independent stores share one physical listener pair per document", () => {
        const page = install(true)
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(focusAtom, () => seen.push("first"))
        const stopSecond = second.sub(focusAtom, () => seen.push("second"))
        expect(listeners(page)).toEqual({ focus: 1, blur: 1 })
        expect(hub()?.registrations()).toBe(2)

        page.fire("window", "blur")
        expect(seen).toEqual(["first", "second"])

        stopFirst()
        expect(listeners(page)).toEqual({ focus: 1, blur: 1 })
        expect(hub()?.registrations()).toBe(1)

        // The surviving store keeps receiving events after the other detaches.
        seen.length = 0
        page.fire("window", "focus")
        expect(seen).toEqual(["second"])
        expect(second.get(focusAtom)).toBe(true)

        stopSecond()
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })

    test("a child scope shares its root's registration", () => {
        const page = install(true)
        const app = store()
        const child = app.scope()

        const stopRoot = app.sub(focusAtom, () => {})
        const stopChild = child.sub(focusAtom, () => {})
        expect(hub()?.registrations()).toBe(1)
        expect(page.physical()).toBe(2)

        page.fire("window", "blur")
        expect(child.get(focusAtom)).toBe(false)

        stopChild()
        stopRoot()
        expect(page.physical()).toBe(0)
        child.dispose()
        app.dispose()
    })

    test("disposing the last retaining store detaches the hub", () => {
        const page = install(true)
        const first = store()
        const second = store()
        first.sub(focusAtom, () => {})
        second.sub(focusAtom, () => {})

        first.dispose()
        expect(hub()?.registrations()).toBe(1)
        expect(page.physical()).toBe(2)

        second.dispose()
        expect(page.physical()).toBe(0)
    })

    test("reattaching re-samples the window instead of reviving the old hub state", () => {
        const page = install(true)
        const app = store()

        const first = app.sub(focusAtom, () => {})
        page.fire("window", "blur")
        expect(app.get(focusAtom)).toBe(false)
        first()

        // The platform reports focus now; a new hub starts from that sample.
        const second = app.sub(focusAtom, () => {})
        expect(app.get(focusAtom)).toBe(true)
        second()
        app.dispose()
    })

    test("one throwing subscriber cannot starve another store, and its failure is reported", () => {
        const page = install(true)
        const failing = store()
        const healthy = store()
        let healthyRuns = 0
        const stopFailing = failing.sub(focusAtom, () => {
            throw new Error("subscriber exploded")
        })
        const stopHealthy = healthy.sub(focusAtom, () => healthyRuns++)

        // The hub delivers to every store before rethrowing from its listener.
        const reported = page.fireReportingErrors("window", "blur")
        expect(healthyRuns).toBe(1)
        expect(healthy.get(focusAtom)).toBe(false)
        expect(failing.get(focusAtom)).toBe(false)
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")

        stopFailing()
        stopHealthy()
        failing.dispose()
        healthy.dispose()
    })

    test("several failing stores are reported together as one AggregateError", () => {
        const page = install(true)
        const stores = [store(), store(), store()]
        const stops = stores.map((app, index) =>
            app.sub(focusAtom, () => {
                if (index !== 1) throw new Error(`store ${index}`)
            }),
        )

        const reported = page.fireReportingErrors("window", "blur")
        expect(reported).toHaveLength(1)
        expect(reported[0]).toBeInstanceOf(AggregateError)
        expect((reported[0] as AggregateError).errors).toHaveLength(2)
        for (const app of stores) expect(app.get(focusAtom)).toBe(false)

        for (const stop of stops) stop()
        for (const app of stores) app.dispose()
    })

    test("a store unsubscribing another mid-delivery does not invalidate it afterwards", () => {
        const page = install(true)
        const first = store()
        const second = store()
        let secondRuns = 0
        let stopSecond = () => {}
        const stopFirst = first.sub(focusAtom, () => stopSecond())
        stopSecond = second.sub(focusAtom, () => secondRuns++)

        page.fire("window", "blur")
        expect(secondRuns).toBe(0)
        expect(hub()?.registrations()).toBe(1)

        stopFirst()
        first.dispose()
        second.dispose()
    })

    test("a partial attachment failure leaves no listener and no hub behind", () => {
        const page = install(true)
        const app = store()
        const boom = new Error("addEventListener rejected")
        page.failOnAttach("window", "blur", boom)

        let thrown: unknown
        try {
            app.sub(focusAtom, () => {})
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(ExternalSourceOperationError)
        expect((thrown as ExternalSourceOperationError).cause).toBe(boom)
        expect(page.attachCalls("window", "focus")).toBe(1)
        expect(page.physical()).toBe(0)
        expect(hub()).toBeUndefined()

        // A later subscription attaches normally.
        page.failOnAttach("window", "blur", undefined)
        const stop = app.sub(focusAtom, () => {})
        expect(page.physical()).toBe(2)
        stop()
        app.dispose()
    })

    test("the source is read-only browser truth", () => {
        install(true)
        const app = store()
        const loose = app as unknown as Record<
            "set" | "reset" | "update",
            (...args: unknown[]) => void
        >
        expect(() => loose.set(focusAtom, false)).toThrow(TypeError)
        expect(() => loose.reset(focusAtom)).toThrow(TypeError)
        expect(() => loose.update(focusAtom, () => false)).toThrow(TypeError)
        expect(app.get(focusAtom)).toBe(true)
        app.dispose()
    })

    test("the server snapshot is a fixed seed, whatever the live value", () => {
        install(false)
        expect(focusSource.getServerSnapshot?.()).toBe(FOCUS_UNAVAILABLE)
        expect(FOCUS_UNAVAILABLE).toBe(true)
    })
})
