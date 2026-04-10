import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext, type Signal } from "@angular/core"
import {
    atom,
    atomFamily,
    selector,
    selectorFamily,
    store as createStore,
} from "valdres"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"
import { injectValue } from "./injectValue"

const createInjector = (storeInstance = createStore()) => {
    const injector = Injector.create({
        providers: [
            {
                provide: VALDRES_STORE,
                useValue: {
                    current: storeInstance,
                    stores: { [storeInstance.data.id]: storeInstance },
                },
            },
        ],
    })
    return { injector, store: storeInstance }
}

describe("injectValue", () => {
    test("atom", () => {
        const numberAtom = atom(10)
        const { injector, store } = createInjector()
        let sig: Signal<number>
        runInInjectionContext(injector, () => {
            sig = injectValue(numberAtom)
        })
        expect(sig!()).toBe(10)
        store.set(numberAtom, 20)
        expect(sig!()).toBe(20)
    })

    test("selector", () => {
        const numberAtom = atom(10)
        const doubleSelector = selector(get => get(numberAtom) * 2)
        const { injector, store } = createInjector()
        let sig: Signal<number>
        runInInjectionContext(injector, () => {
            sig = injectValue(doubleSelector)
        })
        expect(sig!()).toBe(20)
        store.set(numberAtom, 20)
        expect(sig!()).toBe(40)
    })

    test("selectorFamily", () => {
        const numberAtom = atom(10)
        const multiply = selectorFamily(
            (factor: number) => (get: any) => get(numberAtom) * factor,
        )
        const { injector, store } = createInjector()
        let sig: Signal<number>
        runInInjectionContext(injector, () => {
            sig = injectValue(multiply(3))
        })
        expect(sig!()).toBe(30)
        store.set(numberAtom, 20)
        expect(sig!()).toBe(60)
    })

    test("atomFamily", () => {
        const family = atomFamily(1)
        const familyAtom = family("key1")
        const { injector, store } = createInjector()
        let sig: Signal<number>
        runInInjectionContext(injector, () => {
            sig = injectValue(familyAtom)
        })
        expect(sig!()).toBe(1)
        store.set(familyAtom, 99)
        expect(sig!()).toBe(99)
    })

    test("with explicit store", () => {
        const numberAtom = atom(10)
        const storeInstance = createStore()
        const injector = Injector.create({ providers: [] })
        let sig: Signal<number>
        runInInjectionContext(injector, () => {
            sig = injectValue(numberAtom, storeInstance)
        })
        expect(sig!()).toBe(10)
    })

    test("unsubscribes on destroy", () => {
        const numberAtom = atom(10)
        const { injector, store } = createInjector()
        let sig: Signal<number>
        runInInjectionContext(injector, () => {
            sig = injectValue(numberAtom)
        })
        expect(sig!()).toBe(10)
        injector.destroy(false)
        store.set(numberAtom, 99)
        // Signal should keep the last value before destroy
        expect(sig!()).toBe(10)
    })
})
