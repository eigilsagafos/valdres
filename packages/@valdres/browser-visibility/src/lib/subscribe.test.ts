import { describe, test, expect, afterEach } from "bun:test"
import { store } from "valdres"
import { subscribe } from "./subscribe"
import { visibilityAtom } from "../atoms/visibilityAtom"

const setVisibility = (value: DocumentVisibilityState) => {
    Object.defineProperty(document, "visibilityState", {
        value,
        configurable: true,
    })
}

describe("subscribe", () => {
    afterEach(() => setVisibility("visible"))

    test("syncs initial value from document.visibilityState", () => {
        setVisibility("hidden")
        const s = store()
        const cleanup = subscribe()
        expect(s.get(visibilityAtom)).toBe("hidden")
        cleanup?.()
    })

    test("updates atom when visibilitychange event fires", () => {
        setVisibility("visible")
        const s = store()
        const cleanup = subscribe()

        expect(s.get(visibilityAtom)).toBe("visible")

        setVisibility("hidden")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(visibilityAtom)).toBe("hidden")

        setVisibility("visible")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(visibilityAtom)).toBe("visible")

        cleanup?.()
    })

    test("cleanup removes listeners so later events do not update atom", () => {
        setVisibility("visible")
        const s = store()
        const cleanup = subscribe()
        cleanup?.()

        setVisibility("hidden")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(visibilityAtom)).toBe("visible")
    })
})
