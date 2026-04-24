import { afterEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { screenAtom } from "../atoms/screenAtom"
import { subscribe } from "./subscribe"

const setDPR = (value: number) =>
    Object.defineProperty(window, "devicePixelRatio", {
        value,
        configurable: true,
    })

describe("subscribe", () => {
    const originalMatchMedia = window.matchMedia

    afterEach(() => {
        window.matchMedia = originalMatchMedia
        setDPR(1)
    })

    test("updates screenAtom when matchMedia resolution change fires", () => {
        let current: (EventTarget & { matches: boolean; media: string }) | null =
            null
        window.matchMedia = ((query: string) => {
            const mq = new EventTarget() as EventTarget & {
                matches: boolean
                media: string
            }
            mq.matches = true
            mq.media = query
            current = mq
            return mq as unknown as MediaQueryList
        }) as typeof window.matchMedia

        const s = store()
        const cleanup = subscribe()

        setDPR(2)
        current?.dispatchEvent(new Event("change"))
        expect(s.get(screenAtom).devicePixelRatio).toBe(2)

        // listener should be rebound to the new DPR
        setDPR(3)
        current?.dispatchEvent(new Event("change"))
        expect(s.get(screenAtom).devicePixelRatio).toBe(3)
        expect(current?.media).toBe("(resolution: 3dppx)")

        cleanup?.()
    })

    test("cleanup removes the resize listener", () => {
        const s = store()
        const cleanup = subscribe()

        setDPR(2)
        window.dispatchEvent(new Event("resize"))
        expect(s.get(screenAtom).devicePixelRatio).toBe(2)

        cleanup?.()

        setDPR(4)
        window.dispatchEvent(new Event("resize"))
        expect(s.get(screenAtom).devicePixelRatio).toBe(2)
    })
})
