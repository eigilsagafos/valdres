import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { store as createStore } from "valdres"
import { useStore } from "./useStore"
import { StoreKey } from "./lib/storeKey"

describe("useStore", () => {
    test("returns injected store", () => {
        const storeInstance = createStore()
        let result: any
        const Comp = defineComponent({
            setup() {
                result = useStore()
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp, {
            global: {
                provide: { [StoreKey as symbol]: storeInstance },
            },
        })
        expect(result.data.id).toBe(storeInstance.data.id)
    })

    test("throws without provider", () => {
        const Comp = defineComponent({
            setup() {
                useStore()
                return {}
            },
            template: "<div></div>",
        })
        expect(() => mount(Comp)).toThrow("No ValdresPlugin installed")
    })
})
