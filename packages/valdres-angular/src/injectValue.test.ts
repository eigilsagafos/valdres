import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import {
    atom,
    atomFamily,
    selector,
    selectorFamily,
    store as createStore,
} from "valdres"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"
import { injectValue, type ValueState } from "./injectValue"

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
        let result: ValueState<number>
        runInInjectionContext(injector, () => {
            result = injectValue(numberAtom)
        })
        expect(result!.value()).toBe(10)
        expect(result!.status()).toBe("resolved")
        store.set(numberAtom, 20)
        expect(result!.value()).toBe(20)
    })

    test("selector", () => {
        const numberAtom = atom(10)
        const doubleSelector = selector(get => get(numberAtom) * 2)
        const { injector, store } = createInjector()
        let result: ValueState<number>
        runInInjectionContext(injector, () => {
            result = injectValue(doubleSelector)
        })
        expect(result!.value()).toBe(20)
        store.set(numberAtom, 20)
        expect(result!.value()).toBe(40)
    })

    test("selectorFamily", () => {
        const numberAtom = atom(10)
        const multiply = selectorFamily(
            (factor: number) => (get: any) => get(numberAtom) * factor,
        )
        const { injector, store } = createInjector()
        let result: ValueState<number>
        runInInjectionContext(injector, () => {
            result = injectValue(multiply(3))
        })
        expect(result!.value()).toBe(30)
        store.set(numberAtom, 20)
        expect(result!.value()).toBe(60)
    })

    test("atomFamily", () => {
        const family = atomFamily(1)
        const familyAtom = family("key1")
        const { injector, store } = createInjector()
        let result: ValueState<number>
        runInInjectionContext(injector, () => {
            result = injectValue(familyAtom)
        })
        expect(result!.value()).toBe(1)
        store.set(familyAtom, 99)
        expect(result!.value()).toBe(99)
    })

    test("with explicit store", () => {
        const numberAtom = atom(10)
        const storeInstance = createStore()
        const injector = Injector.create({ providers: [] })
        let result: ValueState<number>
        runInInjectionContext(injector, () => {
            result = injectValue(numberAtom, storeInstance)
        })
        expect(result!.value()).toBe(10)
        expect(result!.status()).toBe("resolved")
    })

    test("sync state is immediately resolved", () => {
        const numberAtom = atom(42)
        const { injector } = createInjector()
        let result: ValueState<number>
        runInInjectionContext(injector, () => {
            result = injectValue(numberAtom)
        })
        expect(result!.value()).toBe(42)
        expect(result!.status()).toBe("resolved")
        expect(result!.isLoading()).toBe(false)
        expect(result!.hasValue()).toBe(true)
        expect(result!.error()).toBe(undefined)
    })

    test("resolves async selector", async () => {
        const asyncSelector = selector(
            () => new Promise<string>(r => setTimeout(() => r("hello"), 10)),
        )
        const { injector } = createInjector()
        let result: ValueState<string>
        runInInjectionContext(injector, () => {
            result = injectValue(asyncSelector)
        })

        expect(result!.value()).toBe(undefined)
        expect(result!.status()).toBe("loading")
        expect(result!.isLoading()).toBe(true)
        expect(result!.hasValue()).toBe(false)

        await new Promise(r => setTimeout(r, 50))

        expect(result!.value()).toBe("hello")
        expect(result!.status()).toBe("resolved")
        expect(result!.isLoading()).toBe(false)
        expect(result!.hasValue()).toBe(true)
        expect(result!.error()).toBe(undefined)
    })

    test("handles error in async selector", async () => {
        const failSelector = selector(
            () =>
                new Promise((_, reject) =>
                    setTimeout(() => reject("boom"), 10),
                ),
        )
        const { injector } = createInjector()
        let result: ValueState<string>
        runInInjectionContext(injector, () => {
            result = injectValue(failSelector)
        })

        expect(result!.status()).toBe("loading")

        await new Promise(r => setTimeout(r, 50))

        expect(result!.status()).toBe("error")
        expect(result!.error()).toBe("boom")
        expect(result!.value()).toBe(undefined)
        expect(result!.hasValue()).toBe(false)
    })

    test("transitions back to loading on dependency change", async () => {
        const idAtom = atom(1)
        const userSelector = selector(
            get =>
                new Promise<string>(r =>
                    setTimeout(() => r("User " + get(idAtom)), 10),
                ),
        )
        const { injector, store } = createInjector()
        let result: ValueState<string>
        runInInjectionContext(injector, () => {
            result = injectValue(userSelector)
        })

        expect(result!.status()).toBe("loading")

        await new Promise(r => setTimeout(r, 50))
        expect(result!.value()).toBe("User 1")
        expect(result!.status()).toBe("resolved")

        store.set(idAtom, 2)
        await new Promise(r => setTimeout(r, 5))
        expect(result!.status()).toBe("loading")

        await new Promise(r => setTimeout(r, 50))
        expect(result!.value()).toBe("User 2")
        expect(result!.status()).toBe("resolved")
    })

    test("unsubscribes on destroy (sync)", () => {
        const numberAtom = atom(10)
        const { injector, store } = createInjector()
        let result: ValueState<number>
        runInInjectionContext(injector, () => {
            result = injectValue(numberAtom)
        })
        expect(result!.value()).toBe(10)
        injector.destroy(false)
        store.set(numberAtom, 99)
        expect(result!.value()).toBe(10)
    })

    test("unsubscribes on destroy (async)", async () => {
        const asyncSelector = selector(
            () => new Promise<string>(r => setTimeout(() => r("hello"), 10)),
        )
        const { injector } = createInjector()
        let result: ValueState<string>
        runInInjectionContext(injector, () => {
            result = injectValue(asyncSelector)
        })

        injector.destroy(false)

        await new Promise(r => setTimeout(r, 50))
        expect(result!.value()).toBe(undefined)
    })
})
