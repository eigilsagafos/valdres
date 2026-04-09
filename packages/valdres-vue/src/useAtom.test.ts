import { describe, test, expect, mock } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, watch, type Ref } from "vue"
import { atom, store as createStore } from "valdres"
import { useAtom } from "./useAtom"


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

    test("unsubscribes on unmount", async () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        const callback = mock(() => {})
        let ref: Ref<number>
        const Comp = defineComponent({
            setup() {
                ref = useAtom(countAtom, storeInstance)
                // Watch the ref to detect reactive updates
                watch(ref, callback)
                return {}
            },
            template: "<div></div>",
        })
        const wrapper = mount(Comp)
        expect(ref!.value).toBe(0)
        storeInstance.set(countAtom, 1)
        await new Promise(r => queueMicrotask(r))
        expect(callback).toHaveBeenCalledTimes(1)
        wrapper.unmount()
        storeInstance.set(countAtom, 999)
        await new Promise(r => queueMicrotask(r))
        // No additional reactive notification after unmount
        expect(callback).toHaveBeenCalledTimes(1)
    })
})
