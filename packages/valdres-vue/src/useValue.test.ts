import { describe, test, expect, mock } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, ref as vueRef, watch, type Ref } from "vue"
import { atom, atomFamily, selector, selectorFamily, store as createStore } from "valdres"
import { useValue } from "./useValue"
import { useAtom } from "./useAtom"
import { ValdresKey } from "./lib/storeKey"

const mountWithStore = (
    setup: () => any,
    storeInstance = createStore(),
) => {
    const Comp = defineComponent({
        setup,
        template: "<div></div>",
    })
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

describe("useValue", () => {
    test("atom", async () => {
        const numberAtom = atom(10)
        let ref: Readonly<Ref<number>>
        const { store } = mountWithStore(() => {
            ref = useValue(numberAtom)
            return { ref }
        })
        expect(ref!.value).toBe(10)
        store.set(numberAtom, 20)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(20)
    })

    test("selector", async () => {
        const numberAtom = atom(10)
        const doubleSelector = selector(get => get(numberAtom) * 2)
        let ref: Readonly<Ref<number>>
        const { store } = mountWithStore(() => {
            ref = useValue(doubleSelector)
            return { ref }
        })
        expect(ref!.value).toBe(20)
        store.set(numberAtom, 20)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(40)
    })

    test("selectorFamily", async () => {
        const numberAtom = atom(10)
        const multiply = selectorFamily(
            (factor: number) => (get: any) => get(numberAtom) * factor,
        )
        let ref: Readonly<Ref<number>>
        const { store } = mountWithStore(() => {
            ref = useValue(multiply(3))
            return { ref }
        })
        expect(ref!.value).toBe(30)
        store.set(numberAtom, 20)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(60)
    })

    test("atomFamily", async () => {
        const family = atomFamily(1)
        const familyAtom = family("key1")
        let ref: Readonly<Ref<number>>
        const { store } = mountWithStore(() => {
            ref = useValue(familyAtom)
            return { ref }
        })
        expect(ref!.value).toBe(1)
        store.set(familyAtom, 99)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(99)
    })

    test("with explicit store", () => {
        const numberAtom = atom(10)
        const storeInstance = createStore()
        let ref: Readonly<Ref<number>>
        const Comp = defineComponent({
            setup() {
                ref = useValue(numberAtom, storeInstance)
                return { ref }
            },
            template: "<div></div>",
        })
        mount(Comp)
        expect(ref!.value).toBe(10)
    })

    test("unsubscribes on unmount", async () => {
        const numberAtom = atom(10)
        const callback = mock(() => {})
        let ref: Readonly<Ref<number>>
        const { wrapper, store } = mountWithStore(() => {
            ref = useValue(numberAtom)
            // The read-through ref reads live, so assert on reactivity: no
            // trigger fires after unmount once the subscription is cleaned up.
            watch(ref, callback)
            return { ref }
        })
        expect(ref!.value).toBe(10)
        store.set(numberAtom, 20)
        await new Promise(r => queueMicrotask(r))
        expect(callback).toHaveBeenCalledTimes(1)
        wrapper.unmount()
        store.set(numberAtom, 99)
        await new Promise(r => queueMicrotask(r))
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("multiple components subscribe independently", async () => {
        const numberAtom = atom(0)
        let refA: Readonly<Ref<number>>
        let refB: Readonly<Ref<number>>
        const storeInstance = createStore()

        const CompA = defineComponent({
            setup() {
                refA = useValue(numberAtom)
                return () => null
            },
        })
        const CompB = defineComponent({
            setup() {
                refB = useValue(numberAtom)
                return () => null
            },
        })

        const provide = {
            [ValdresKey as symbol]: {
                current: storeInstance,
                stores: { [storeInstance.data.id]: storeInstance },
            },
        }
        mount(CompA, { global: { provide } })
        mount(CompB, { global: { provide } })

        expect(refA!.value).toBe(0)
        expect(refB!.value).toBe(0)
        storeInstance.set(numberAtom, 42)
        await new Promise(r => queueMicrotask(r))
        expect(refA!.value).toBe(42)
        expect(refB!.value).toBe(42)
    })

    test("reactive family key (getter) tracks the new member", async () => {
        const family = atomFamily((key: string) => `default-${key}`)
        const keyRef = vueRef("a")
        const store = createStore({ batchUpdates: true })
        store.set(family("a"), "A")
        store.set(family("b"), "B")

        let ref: Readonly<Ref<string>>
        mountWithStore(() => {
            ref = useValue(() => family(keyRef.value))
            return { ref }
        }, store)

        expect(ref!.value).toBe("A")
        keyRef.value = "b"
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe("B")

        // A set on the now-tracked member propagates.
        store.set(family("b"), "B2")
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe("B2")
    })

    test("read-after-write is fresh on a batched store (parity with useAtom)", () => {
        const countAtom = atom(1)
        const doubled = selector(get => get(countAtom) * 2)
        const store = createStore({ batchUpdates: true })

        let viaValue: Readonly<Ref<number>>
        let viaAtom: Ref<number>
        mountWithStore(() => {
            viaValue = useValue(doubled)
            viaAtom = useAtom(countAtom)
            return {}
        }, store)

        expect(viaValue!.value).toBe(2)
        store.set(countAtom, 5)
        // No microtask wait: read-through reads live, like useAtom.
        expect(viaAtom!.value).toBe(5)
        expect(viaValue!.value).toBe(10)
    })

    test("async selector is undefined while pending, never throws", async () => {
        let resolveFn: (v: number) => void
        const promise = new Promise<number>(r => {
            resolveFn = r
        })
        const asyncSel = selector(() => promise)
        const store = createStore({ batchUpdates: true })

        let ref: Readonly<Ref<number>>
        expect(() => {
            mountWithStore(() => {
                ref = useValue(asyncSel)
                return {}
            }, store)
        }).not.toThrow()

        expect(ref!.value).toBeUndefined()
        resolveFn!(7)
        await promise
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(7)
    })

    test("promise atom default does not throw", () => {
        const asyncAtom = atom(Promise.resolve(99))
        const store = createStore({ batchUpdates: true })
        let ref: Readonly<Ref<Promise<number>>>
        expect(() => {
            mountWithStore(() => {
                ref = useValue(asyncAtom)
                return {}
            }, store)
        }).not.toThrow()
        expect(ref!.value).toBeUndefined()
    })
})
