import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { atom, store as createStore } from "valdres"
import { injectSetAtom } from "./injectSetAtom"

describe("injectSetAtom", () => {
    test("sets atom value", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        let setter: (v: any) => void
        const injector = Injector.create({ providers: [] })
        runInInjectionContext(injector, () => {
            setter = injectSetAtom(countAtom, storeInstance)
        })
        expect(storeInstance.get(countAtom)).toBe(0)
        setter!(42)
        expect(storeInstance.get(countAtom)).toBe(42)
    })

    test("sets atom with updater function", () => {
        const countAtom = atom(10)
        const storeInstance = createStore()
        let setter: (v: any) => void
        const injector = Injector.create({ providers: [] })
        runInInjectionContext(injector, () => {
            setter = injectSetAtom(countAtom, storeInstance)
        })
        setter!((prev: number) => prev + 5)
        expect(storeInstance.get(countAtom)).toBe(15)
    })
})
