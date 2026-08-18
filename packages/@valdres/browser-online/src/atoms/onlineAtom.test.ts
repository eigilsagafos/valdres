import { describe, test, expect, afterAll } from "bun:test"
import { store } from "valdres"
import { onlineAtom } from "./onlineAtom"

const setOnLine = (value: boolean) => {
    Object.defineProperty(navigator, "onLine", {
        value,
        configurable: true,
    })
}

describe("onlineAtom", () => {
    afterAll(() => setOnLine(true))

    test("subscribing wires event listeners and reflects navigator state", () => {
        setOnLine(false)
        const s = store()
        const unsub = s.sub(onlineAtom, () => {})
        expect(s.get(onlineAtom)).toBe(false)

        setOnLine(true)
        window.dispatchEvent(new Event("online"))
        expect(s.get(onlineAtom)).toBe(true)

        setOnLine(false)
        window.dispatchEvent(new Event("offline"))
        expect(s.get(onlineAtom)).toBe(false)
        unsub()
    })

    // Runtime control for the migration off `atom(default, { global: true,
    // name })` onto the dedicated `globalAtom(default, { name })` constructor
    // (C6): a migrated browser-package atom must still fan a write out to
    // every store that touches it, not just the store that triggered it.
    test("a write fans out across every store subscribed to the migrated atom", () => {
        setOnLine(true)
        const storeA = store()
        const storeB = store()
        const unsubA = storeA.sub(onlineAtom, () => {})
        const unsubB = storeB.sub(onlineAtom, () => {})
        expect(storeA.get(onlineAtom)).toBe(true)
        expect(storeB.get(onlineAtom)).toBe(true)

        setOnLine(false)
        window.dispatchEvent(new Event("offline"))

        expect(storeA.get(onlineAtom)).toBe(false)
        expect(storeB.get(onlineAtom)).toBe(false)

        unsubA()
        unsubB()
    })
})
