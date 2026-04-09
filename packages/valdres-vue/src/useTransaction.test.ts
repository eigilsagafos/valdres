import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { atom, store as createStore } from "valdres"
import { useTransaction } from "./useTransaction"


describe("useTransaction", () => {
    test("executes transaction", () => {
        const atomA = atom(1)
        const atomB = atom(2)
        const storeInstance = createStore()
        let txn: any
        const Comp = defineComponent({
            setup() {
                txn = useTransaction(storeInstance)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp)
        txn(({ set }: any) => {
            set(atomA, 10)
            set(atomB, 20)
        })
        expect(storeInstance.get(atomA)).toBe(10)
        expect(storeInstance.get(atomB)).toBe(20)
    })
})
