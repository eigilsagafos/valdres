import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { reducedTransparencyAtom } from "./reducedTransparencyAtom"

type MockMq = EventTarget & { matches: boolean; media: string }

const installMatchMedia = (initialMatches: boolean) => {
    const mqs: MockMq[] = []
    let matches = initialMatches
    window.matchMedia = ((query: string) => {
        const mq = new EventTarget() as MockMq
        mq.matches = matches
        mq.media = query
        mqs.push(mq)
        return mq as unknown as MediaQueryList
    }) as typeof window.matchMedia
    return {
        set: (next: boolean) => {
            matches = next
            for (const mq of mqs) {
                mq.matches = next
                mq.dispatchEvent(new Event("change"))
            }
        },
    }
}

describe("reducedTransparencyAtom", () => {
    const originalMatchMedia = window.matchMedia
    afterEach(() => {
        window.matchMedia = originalMatchMedia
        reducedTransparencyAtom.resetSelf()
    })

    test("initial value reflects matchMedia at first read", () => {
        installMatchMedia(true)
        const s = store()
        expect(s.get(reducedTransparencyAtom)).toBe("reduce")
    })

    test("updates when media query change event fires", () => {
        const mq = installMatchMedia(false)
        const s = store()
        expect(s.get(reducedTransparencyAtom)).toBe("no-preference")

        mq.set(true)
        expect(s.get(reducedTransparencyAtom)).toBe("reduce")

        mq.set(false)
        expect(s.get(reducedTransparencyAtom)).toBe("no-preference")
    })
})
