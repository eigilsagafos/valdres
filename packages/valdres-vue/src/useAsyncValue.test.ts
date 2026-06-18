import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, ref as vueRef } from "vue"
import { atom, selector, selectorFamily, store as createStore } from "valdres"
import { useAsyncValue, type AsyncValue } from "./useAsyncValue"
import { ValdresKey } from "./lib/storeKey"

const mountWithStore = (setup: () => any, storeInstance = createStore({ batchUpdates: true })) => {
    const Comp = defineComponent({ setup, template: "<div></div>" })
    const wrapper = mount(Comp, {
        global: {
            provide: {
                [ValdresKey as symbol]: {
                    current: storeInstance,
                    stores: { [storeInstance.data.id]: storeInstance },
                },
            },
        },
    })
    return { wrapper, store: storeInstance }
}

describe("useAsyncValue", () => {
    test("pending -> success", async () => {
        let resolveFn: (v: number) => void
        const promise = new Promise<number>(r => {
            resolveFn = r
        })
        const asyncSel = selector(() => promise)

        let box: AsyncValue<number>
        mountWithStore(() => {
            box = useAsyncValue(asyncSel)
            return {}
        })

        expect(box!.status.value).toBe("pending")
        expect(box!.isPending.value).toBe(true)
        expect(box!.data.value).toBeUndefined()

        resolveFn!(42)
        await promise
        await new Promise(r => queueMicrotask(r))

        expect(box!.status.value).toBe("success")
        expect(box!.isPending.value).toBe(false)
        expect(box!.data.value).toBe(42)
        expect(box!.error.value).toBeUndefined()
    })

    test("rejection -> error status", async () => {
        const failure = new Error("boom")
        let rejectFn: (e: unknown) => void
        const promise = new Promise<number>((_, reject) => {
            rejectFn = reject
        })
        // Swallow the unhandled-rejection that bun's test runner would catch.
        promise.catch(() => {})
        const asyncSel = selector(() => promise)

        let box: AsyncValue<number>
        mountWithStore(() => {
            box = useAsyncValue(asyncSel)
            return {}
        })

        expect(box!.status.value).toBe("pending")
        rejectFn!(failure)
        await promise.catch(() => {})
        await new Promise(r => queueMicrotask(r))

        expect(box!.status.value).toBe("error")
        expect(box!.error.value).toBe(failure)
        expect(box!.data.value).toBeUndefined()
    })

    test("sync selector resolves immediately to success", () => {
        const numberAtom = atom(3)
        const doubled = selector(get => get(numberAtom) * 2)
        let box: AsyncValue<number>
        mountWithStore(() => {
            box = useAsyncValue(doubled)
            return {}
        })
        expect(box!.status.value).toBe("success")
        expect(box!.data.value).toBe(6)
    })

    test("suspense() resolves through chained dependency promises", async () => {
        const base = selector(() => Promise.resolve(10))
        // chained depends on the async base; core returns the *dependency's*
        // promise when suspended, so suspense() must loop await->re-get.
        const chained = selector(get => (get(base) as number) + 5)

        let box: AsyncValue<number>
        const { store } = mountWithStore(() => {
            box = useAsyncValue(chained)
            return {}
        })

        const value = await box!.suspense()
        expect(value).toBe(15)
        expect(box!.data.value).toBe(15)
        expect(box!.status.value).toBe("success")
        // The synchronous store read is now resolved too.
        expect(store.get(chained)).toBe(15)
    })

    test("suspense() rejects on selector rejection", async () => {
        const failure = new Error("nope")
        const rejected = Promise.reject(failure)
        rejected.catch(() => {})
        const asyncSel = selector(() => rejected)

        let box: AsyncValue<number>
        mountWithStore(() => {
            box = useAsyncValue(asyncSel)
            return {}
        })

        await expect(box!.suspense()).rejects.toThrow("nope")
        expect(box!.status.value).toBe("error")
        expect(box!.error.value).toBe(failure)
    })

    test("reactive key change re-enters pending then resolves", async () => {
        const resolvers: Record<string, (v: string) => void> = {}
        const promises: Record<string, Promise<string>> = {}
        for (const key of ["a", "b"]) {
            promises[key] = new Promise<string>(r => {
                resolvers[key] = r
            })
        }
        const familySel = selectorFamily(
            (key: string) => () => promises[key],
        )
        const keyRef = vueRef("a")

        let box: AsyncValue<string>
        mountWithStore(() => {
            box = useAsyncValue(() => familySel(keyRef.value))
            return {}
        })

        expect(box!.status.value).toBe("pending")
        resolvers.a("A")
        await promises.a
        await new Promise(r => queueMicrotask(r))
        expect(box!.data.value).toBe("A")

        keyRef.value = "b"
        await new Promise(r => queueMicrotask(r))
        expect(box!.status.value).toBe("pending")

        resolvers.b("B")
        await promises.b
        await new Promise(r => queueMicrotask(r))
        expect(box!.data.value).toBe("B")
        expect(box!.status.value).toBe("success")
    })

    test("ignores an in-flight settlement after unmount", async () => {
        let resolveFn: (v: number) => void
        const promise = new Promise<number>(r => {
            resolveFn = r
        })
        const asyncSel = selector(() => promise)

        let box: AsyncValue<number>
        const { wrapper } = mountWithStore(() => {
            box = useAsyncValue(asyncSel)
            return {}
        })

        expect(box!.status.value).toBe("pending")
        wrapper.unmount()

        // The promise the component was awaiting settles after teardown — it
        // must not mutate the (now-orphaned) refs.
        resolveFn!(42)
        await promise
        await new Promise(r => queueMicrotask(r))

        expect(box!.status.value).toBe("pending")
        expect(box!.data.value).toBeUndefined()
    })
})
