import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { atom, store as createStore } from "valdres"
import { useResetAtom } from "./useResetAtom"


describe("useResetAtom", () => {
    test("resets atom to default value", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        storeInstance.set(countAtom, 99)
        let reset: () => void
        const Comp = defineComponent({
            setup() {
                reset = useResetAtom(countAtom, storeInstance)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        expect(storeInstance.get(countAtom)).toBe(99)
        reset!()
        expect(storeInstance.get(countAtom)).toBe(0)
    })
})
