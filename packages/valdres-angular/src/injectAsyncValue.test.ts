import { describe, test, expect } from "bun:test"
import { Injector, runInInjectionContext } from "@angular/core"
import { atom, selector, store as createStore } from "valdres"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"
import { injectAsyncValue, type AsyncValue } from "./injectAsyncValue"

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

describe("injectAsyncValue", () => {
    test("resolves async selector", async () => {
        const asyncSelector = selector(
            () => new Promise<string>(r => setTimeout(() => r("hello"), 10)),
        )
        const { injector } = createInjector()
        let result: AsyncValue<string>
        runInInjectionContext(injector, () => {
            result = injectAsyncValue(asyncSelector)
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

    test("handles sync state immediately", () => {
        const numberAtom = atom(42)
        const { injector } = createInjector()
        let result: AsyncValue<number>
        runInInjectionContext(injector, () => {
            result = injectAsyncValue(numberAtom)
        })

        expect(result!.value()).toBe(42)
        expect(result!.status()).toBe("resolved")
        expect(result!.isLoading()).toBe(false)
        expect(result!.hasValue()).toBe(true)
    })

    test("handles sync selector", () => {
        const numberAtom = atom(10)
        const doubleSelector = selector(get => get(numberAtom) * 2)
        const { injector, store } = createInjector()
        let result: AsyncValue<number>
        runInInjectionContext(injector, () => {
            result = injectAsyncValue(doubleSelector)
        })

        expect(result!.value()).toBe(20)
        expect(result!.status()).toBe("resolved")

        store.set(numberAtom, 20)
        expect(result!.value()).toBe(40)
    })

    test("handles error in async selector", async () => {
        const failSelector = selector(
            () => new Promise((_, reject) => setTimeout(() => reject("boom"), 10)),
        )
        const { injector } = createInjector()
        let result: AsyncValue<string>
        runInInjectionContext(injector, () => {
            result = injectAsyncValue(failSelector)
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
        let result: AsyncValue<string>
        runInInjectionContext(injector, () => {
            result = injectAsyncValue(userSelector)
        })

        expect(result!.status()).toBe("loading")

        await new Promise(r => setTimeout(r, 50))
        expect(result!.value()).toBe("User 1")
        expect(result!.status()).toBe("resolved")

        // Change dependency — should go back to loading
        store.set(idAtom, 2)
        // The sub fires with a new Promise
        await new Promise(r => setTimeout(r, 5))
        expect(result!.status()).toBe("loading")

        await new Promise(r => setTimeout(r, 50))
        expect(result!.value()).toBe("User 2")
        expect(result!.status()).toBe("resolved")
    })

    test("unsubscribes on destroy", async () => {
        const asyncSelector = selector(
            () => new Promise<string>(r => setTimeout(() => r("hello"), 10)),
        )
        const { injector } = createInjector()
        let result: AsyncValue<string>
        runInInjectionContext(injector, () => {
            result = injectAsyncValue(asyncSelector)
        })

        injector.destroy(false)

        await new Promise(r => setTimeout(r, 50))
        // Should still be loading since we destroyed before resolution could update
        expect(result!.value()).toBe(undefined)
    })
})
