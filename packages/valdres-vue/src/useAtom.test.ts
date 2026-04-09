import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, type DeepReadonly, type Ref } from "vue"
import { atom, store as createStore } from "valdres"
import { useAtom } from "./useAtom"
import { StoreKey } from "./lib/storeKey"

describe("useAtom", () => {
    test("returns ref and setter", async () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        let ref: DeepReadonly<Ref<number>>
        let setter: (v: any) => void
        const Comp = defineComponent({
            setup() {
                const [r, s] = useAtom(countAtom, storeInstance)
                ref = r
                setter = s
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        expect(ref!.value).toBe(0)
        setter!(5)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(5)
    })

    test("setter with updater function", async () => {
        const countAtom = atom(10)
        const storeInstance = createStore()
        let setter: (v: any) => void
        let ref: DeepReadonly<Ref<number>>
        const Comp = defineComponent({
            setup() {
                const [r, s] = useAtom(countAtom, storeInstance)
                ref = r
                setter = s
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        setter!((prev: number) => prev + 5)
        await new Promise(r => queueMicrotask(r))
        expect(ref!.value).toBe(15)
    })
})
