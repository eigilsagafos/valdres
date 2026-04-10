import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { atom, store as createStore } from "valdres"
import { injectResetAtom } from "./injectResetAtom"

describe("injectResetAtom", () => {
    test("resets atom to default value", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        storeInstance.set(countAtom, 99)
        let reset: () => void
        const injector = Injector.create({ providers: [] })
        runInInjectionContext(injector, () => {
            reset = injectResetAtom(countAtom, storeInstance)
        })
        expect(storeInstance.get(countAtom)).toBe(99)
        reset!()
        expect(storeInstance.get(countAtom)).toBe(0)
    })
})
