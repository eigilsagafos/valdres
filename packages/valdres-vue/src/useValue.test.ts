import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, type Readonly, type Ref } from "vue"
import { atom, selector, store as createStore } from "valdres"
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
})
