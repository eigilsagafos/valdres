import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { store as createStore } from "valdres"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"
import { injectStore } from "./injectStore"

describe("injectStore", () => {
    test("returns injected store", () => {
        const storeInstance = createStore()
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
        let result: any
        runInInjectionContext(injector, () => {
            result = injectStore()
        })
        expect(result.data.id).toBe(storeInstance.data.id)
    })

    test("throws without provider", () => {
        const injector = Injector.create({ providers: [] })
        expect(() => {
            runInInjectionContext(injector, () => {
                injectStore()
            })
        }).toThrow("No valdres store provided")
    })

    test("looks up store by id", () => {
        const parentStore = createStore()
        const childStore = createStore()
        const injector = Injector.create({
            providers: [
                {
                    provide: VALDRES_STORE,
                    useValue: {
                        current: childStore,
                        stores: {
                            [parentStore.data.id]: parentStore,
                            [childStore.data.id]: childStore,
                        },
                    },
                },
            ],
        })
        let result: any
        runInInjectionContext(injector, () => {
            result = injectStore(parentStore.data.id)
        })
        expect(result.data.id).toBe(parentStore.data.id)
    })

    test("throws for unknown store id", () => {
        const storeInstance = createStore()
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
        expect(() => {
            runInInjectionContext(injector, () => {
                injectStore("nonexistent")
            })
        }).toThrow('No store with id "nonexistent" found')
    })
})
