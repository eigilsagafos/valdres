import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { atom, store as createStore } from "valdres"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"
import { injectAtom, type AtomSignal } from "./injectAtom"

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

describe("injectAtom", () => {
    test("reads initial value", () => {
        const countAtom = atom(0)
        const { injector } = createInjector()
        let sig: AtomSignal<number>
        runInInjectionContext(injector, () => {
            sig = injectAtom(countAtom)
        })
        expect(sig!()).toBe(0)
    })

    test("set updates signal and store", () => {
        const countAtom = atom(0)
        const { injector, store } = createInjector()
        let sig: AtomSignal<number>
        runInInjectionContext(injector, () => {
            sig = injectAtom(countAtom)
        })
        sig!.set(5)
        expect(sig!()).toBe(5)
        expect(store.get(countAtom)).toBe(5)
    })

    test("update with function", () => {
        const countAtom = atom(10)
        const { injector, store } = createInjector()
        let sig: AtomSignal<number>
        runInInjectionContext(injector, () => {
            sig = injectAtom(countAtom)
        })
        sig!.update(v => v + 5)
        expect(sig!()).toBe(15)
        expect(store.get(countAtom)).toBe(15)
    })

    test("reset restores default", () => {
        const countAtom = atom(0)
        const { injector, store } = createInjector()
        let sig: AtomSignal<number>
        runInInjectionContext(injector, () => {
            sig = injectAtom(countAtom)
        })
        sig!.set(99)
        expect(sig!()).toBe(99)
        sig!.reset()
        expect(sig!()).toBe(0)
        expect(store.get(countAtom)).toBe(0)
    })

    test("reacts to external store changes", () => {
        const countAtom = atom(10)
        const { injector, store } = createInjector()
        let sig: AtomSignal<number>
        runInInjectionContext(injector, () => {
            sig = injectAtom(countAtom)
        })
        expect(sig!()).toBe(10)
        store.set(countAtom, 42)
        expect(sig!()).toBe(42)
    })

    test("reacts to store.set with updater function", () => {
        const countAtom = atom(10)
        const { injector, store } = createInjector()
        let sig: AtomSignal<number>
        runInInjectionContext(injector, () => {
            sig = injectAtom(countAtom)
        })
        store.set(countAtom, (prev: number) => prev + 5)
        expect(sig!()).toBe(15)
    })

    test("unsubscribes on destroy", () => {
        const countAtom = atom(0)
        const { injector, store } = createInjector()
        let sig: AtomSignal<number>
        runInInjectionContext(injector, () => {
            sig = injectAtom(countAtom)
        })
        store.set(countAtom, 1)
        expect(sig!()).toBe(1)
        injector.destroy(false)
        store.set(countAtom, 999)
        expect(sig!()).toBe(1)
    })
})
