import { describe, test, expect, mock } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, type Readonly, type Ref } from "vue"
import { atom, atomFamily, selector, selectorFamily, store as createStore } from "valdres"
import { useValue } from "./useValue"
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
        let ref: Readonly<Ref<number>>
        const { wrapper, store } = mountWithStore(() => {
            ref = useValue(numberAtom)
            return { ref }
        })
        expect(ref!.value).toBe(10)
        wrapper.unmount()
        store.set(numberAtom, 99)
        await new Promise(r => queueMicrotask(r))
        // ref should still hold old value since subscription was cleaned up
        expect(ref!.value).toBe(10)
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
})
