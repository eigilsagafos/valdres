import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { atom, store as createStore } from "valdres"
import { VALDRES_STORE, type ValdresContext } from "./lib/VALDRES_STORE"
import { provideValdresScope } from "./provideValdresScope"
import { injectValue } from "./injectValue"

const createParentInjector = (storeInstance = createStore({ batchUpdates: true })) => {
    const ctx: ValdresContext = {
        current: storeInstance,
        stores: { [storeInstance.data.id]: storeInstance },
    }
    const injector = Injector.create({
        providers: [{ provide: VALDRES_STORE, useValue: ctx }],
    })
    return { injector, store: storeInstance, ctx }
}

describe("provideValdresScope", () => {
    test("creates a scoped store", () => {
        const { injector: parent, store: rootStore } = createParentInjector()
        const scopeProviders = provideValdresScope({ scopeId: "child" })
        const childInjector = Injector.create({
            providers: scopeProviders,
            parent,
        })
        const childCtx = childInjector.get(VALDRES_STORE)
        expect(childCtx.current.data.id).not.toBe(rootStore.data.id)
    })

    test("scope starts from defaults and can be set independently", () => {
        const nameAtom = atom("default")
        const { injector: parent, store: rootStore } = createParentInjector()
        rootStore.set(nameAtom, "root")

        const scopeProviders = provideValdresScope({ scopeId: "child" })
        const childInjector = Injector.create({
            providers: scopeProviders,
            parent,
        })
        const childCtx = childInjector.get(VALDRES_STORE)

        // Scope starts from atom default, not parent's current value
        expect(childCtx.current.get(nameAtom)).toBe("default")

        // Setting in scope does not affect parent
        childCtx.current.set(nameAtom, "scoped")
        expect(childCtx.current.get(nameAtom)).toBe("scoped")
        expect(rootStore.get(nameAtom)).toBe("root")
    })

    test("scoped set does not leak to parent", () => {
        const nameAtom = atom("default")
        const { injector: parent, store: rootStore } = createParentInjector()
        const scopeProviders = provideValdresScope({ scopeId: "isolated" })
        const childInjector = Injector.create({
            providers: scopeProviders,
            parent,
        })
        const childCtx = childInjector.get(VALDRES_STORE)

        childCtx.current.set(nameAtom, "scoped-only")
        expect(childCtx.current.get(nameAtom)).toBe("scoped-only")
        expect(rootStore.get(nameAtom)).toBe("default")
    })

    test("initialize with array return", () => {
        const atom1 = atom(1)
        const atom2 = atom(2)
        const { injector: parent } = createParentInjector()
        const scopeProviders = provideValdresScope({
            scopeId: "init",
            initialize: () => [
                [atom1, 10],
                [atom2, 20],
            ],
        })
        const childInjector = Injector.create({
            providers: scopeProviders,
            parent,
        })
        const childCtx = childInjector.get(VALDRES_STORE)
        expect(childCtx.current.get(atom1)).toBe(10)
        expect(childCtx.current.get(atom2)).toBe(20)
    })

    test("initialize with txn.set", () => {
        const countAtom = atom(0)
        const { injector: parent } = createParentInjector()
        const scopeProviders = provideValdresScope({
            scopeId: "txn-init",
            initialize: txn => {
                txn.set(countAtom, 42)
            },
        })
        const childInjector = Injector.create({
            providers: scopeProviders,
            parent,
        })
        const childCtx = childInjector.get(VALDRES_STORE)
        expect(childCtx.current.get(countAtom)).toBe(42)
    })

    test("injectStore(id) accesses parent store from within scope", () => {
        const { injector: parent, store: rootStore } = createParentInjector()
        const scopeProviders = provideValdresScope({ scopeId: "nested" })
        const childInjector = Injector.create({
            providers: scopeProviders,
            parent,
        })
        const childCtx = childInjector.get(VALDRES_STORE)
        expect(childCtx.stores[rootStore.data.id].data.id).toBe(
            rootStore.data.id,
        )
        expect(childCtx.current.data.id).not.toBe(rootStore.data.id)
    })

    test("nested scopes build up store chain", () => {
        const { injector: root, store: rootStore } = createParentInjector()

        const outerProviders = provideValdresScope({ scopeId: "outer" })
        const outerInjector = Injector.create({
            providers: outerProviders,
            parent: root,
        })

        const innerProviders = provideValdresScope({ scopeId: "inner" })
        const innerInjector = Injector.create({
            providers: innerProviders,
            parent: outerInjector,
        })

        const innerCtx = innerInjector.get(VALDRES_STORE)
        expect(innerCtx.current.data.id).not.toBe(rootStore.data.id)
        expect(innerCtx.stores[rootStore.data.id].data.id).toBe(
            rootStore.data.id,
        )
    })

    test("throws without parent store", () => {
        const emptyInjector = Injector.create({ providers: [] })
        const scopeProviders = provideValdresScope({ scopeId: "orphan" })
        const childInjector = Injector.create({
            providers: scopeProviders,
            parent: emptyInjector,
        })
        expect(() => childInjector.get(VALDRES_STORE)).toThrow(
            "No valdres store provided",
        )
    })
})
