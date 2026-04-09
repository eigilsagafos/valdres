import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, type Ref } from "vue"
import { atom, store as createStore } from "valdres"
import { useAtom } from "./useAtom"
import { StoreKey } from "./lib/storeKey"

describe("useAtom", () => {
    test("returns a writable ref", async () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        let ref: Ref<number>
        const Comp = defineComponent({
            setup() {
                ref = useAtom(countAtom, storeInstance)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        expect(ref!.value).toBe(0)
        ref!.value = 5
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(5)
        expect(storeInstance.get(countAtom)).toBe(5)
    })

    test("reacts to external store changes", async () => {
        const countAtom = atom(10)
        const storeInstance = createStore()
        let ref: Ref<number>
        const Comp = defineComponent({
            setup() {
                ref = useAtom(countAtom, storeInstance)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        expect(ref!.value).toBe(10)
        storeInstance.set(countAtom, 42)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(42)
    })

    test("set via store.set with updater function", async () => {
        const countAtom = atom(10)
        const storeInstance = createStore()
        let ref: Ref<number>
        const Comp = defineComponent({
            setup() {
                ref = useAtom(countAtom, storeInstance)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        storeInstance.set(countAtom, (prev: number) => prev + 5)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(15)
    })
})
