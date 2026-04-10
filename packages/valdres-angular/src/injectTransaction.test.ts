import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { atom, store as createStore } from "valdres"
import { injectTransaction } from "./injectTransaction"

describe("injectTransaction", () => {
    test("executes transaction", () => {
        const atomA = atom(1)
        const atomB = atom(2)
        const storeInstance = createStore()
        let txn: any
        const injector = Injector.create({ providers: [] })
        runInInjectionContext(injector, () => {
            txn = injectTransaction(storeInstance)
        })
        txn(({ set }: any) => {
            set(atomA, 10)
            set(atomB, 20)
        })
        expect(storeInstance.get(atomA)).toBe(10)
        expect(storeInstance.get(atomB)).toBe(20)
    })

    test("can read values inside transaction", () => {
        const countAtom = atom(5)
        const storeInstance = createStore()
        let txn: any
        const injector = Injector.create({ providers: [] })
        runInInjectionContext(injector, () => {
            txn = injectTransaction(storeInstance)
        })
        txn(({ get, set }: any) => {
            const current = get(countAtom)
            set(countAtom, current * 3)
        })
        expect(storeInstance.get(countAtom)).toBe(15)
    })
})
