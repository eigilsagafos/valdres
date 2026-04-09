import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { atom, store as createStore } from "valdres"
import { useSetAtom } from "./useSetAtom"


describe("useSetAtom", () => {
    test("sets atom value", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        let setter: (v: any) => void
        const Comp = defineComponent({
            setup() {
                setter = useSetAtom(countAtom, storeInstance)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        expect(storeInstance.get(countAtom)).toBe(0)
        setter!(42)
        expect(storeInstance.get(countAtom)).toBe(42)
    })

    test("sets atom with updater function", () => {
        const countAtom = atom(10)
        const storeInstance = createStore()
        let setter: (v: any) => void
        const Comp = defineComponent({
            setup() {
                setter = useSetAtom(countAtom, storeInstance)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        setter!((prev: number) => prev + 5)
        expect(storeInstance.get(countAtom)).toBe(15)
    })
})
