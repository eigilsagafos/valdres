import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { contrastAtom, type Contrast } from "./contrastAtom"

type MockMq = EventTarget & { matches: boolean; media: string }

const installMatchMedia = (initial: Contrast) => {
    const mqsByQuery = new Map<string, MockMq[]>()
    let current: Contrast = initial
    const matchesFor = (query: string) => {
        if (query.includes("more")) return current === "more"
        if (query.includes("less")) return current === "less"
        if (query.includes("custom")) return current === "custom"
        return false
    }
    window.matchMedia = ((query: string) => {
        const mq = new EventTarget() as MockMq
        mq.matches = matchesFor(query)
        mq.media = query
        const bucket = mqsByQuery.get(query) ?? []
        bucket.push(mq)
        mqsByQuery.set(query, bucket)
        return mq as unknown as MediaQueryList
    }) as typeof window.matchMedia
    return {
        set: (next: Contrast) => {
            current = next
            for (const [query, bucket] of mqsByQuery) {
                const m = matchesFor(query)
                for (const mq of bucket) {
                    if (mq.matches !== m) {
                        mq.matches = m
                        mq.dispatchEvent(new Event("change"))
                    }
                }
            }
        },
    }
}

describe("contrastAtom", () => {
    const originalMatchMedia = window.matchMedia
    afterEach(() => {
        window.matchMedia = originalMatchMedia
        contrastAtom.resetSelf()
    })

    test("initial value reflects active media query", () => {
        installMatchMedia("more")
        const s = store()
        expect(s.get(contrastAtom)).toBe("more")
    })

    test("falls back to no-preference when no query matches", () => {
        installMatchMedia("no-preference")
        const s = store()
        expect(s.get(contrastAtom)).toBe("no-preference")
    })

    test("updates when any media query change event fires", () => {
        const mq = installMatchMedia("no-preference")
        const s = store()
        expect(s.get(contrastAtom)).toBe("no-preference")

        mq.set("more")
        expect(s.get(contrastAtom)).toBe("more")

        mq.set("less")
        expect(s.get(contrastAtom)).toBe("less")

        mq.set("custom")
        expect(s.get(contrastAtom)).toBe("custom")

        mq.set("no-preference")
        expect(s.get(contrastAtom)).toBe("no-preference")
    })
})
