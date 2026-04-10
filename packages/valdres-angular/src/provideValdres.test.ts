import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { atom, store as createStore } from "valdres"
import { VALDRES_STORE, type ValdresContext } from "./lib/VALDRES_STORE"
import { provideValdres } from "./provideValdres"

describe("provideValdres", () => {
    test("creates a store when none provided", () => {
        const providers = provideValdres()
        const injector = Injector.create({ providers: [providers] as any[] })
        let ctx: ValdresContext
        runInInjectionContext(injector, () => {
            ctx = injector.get(VALDRES_STORE)
        })
        expect(ctx!).toBeDefined()
        expect(ctx!.current).toBeDefined()
        expect(ctx!.current.data.id).toBeDefined()
    })

    test("accepts existing store", () => {
        const storeInstance = createStore({ batchUpdates: true })
        const providers = provideValdres({ store: storeInstance })
        const injector = Injector.create({ providers: [providers] as any[] })
        const ctx = injector.get(VALDRES_STORE)
        expect(ctx.current.data.id).toBe(storeInstance.data.id)
    })

    test("initialize with array return", () => {
        const countAtom = atom(0)
        const providers = provideValdres({
            initialize: () => [[countAtom, 42]],
        })
        const injector = Injector.create({ providers: [providers] as any[] })
        const ctx = injector.get(VALDRES_STORE)
        expect(ctx.current.get(countAtom)).toBe(42)
    })

    test("initialize with txn.set", () => {
        const countAtom = atom(0)
        const providers = provideValdres({
            initialize: txn => {
                txn.set(countAtom, 99)
            },
        })
        const injector = Injector.create({ providers: [providers] as any[] })
        const ctx = injector.get(VALDRES_STORE)
        expect(ctx.current.get(countAtom)).toBe(99)
    })
})
