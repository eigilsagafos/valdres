import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { store as createStore } from "valdres"
import { useStore } from "./useStore"
import { ValdresKey } from "./lib/storeKey"

const provideStore = (storeInstance: ReturnType<typeof createStore>) => ({
    [ValdresKey as symbol]: {
        current: storeInstance,
        stores: { [storeInstance.data.id]: storeInstance },
    },
})

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
                provide: provideStore(storeInstance),
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
        expect(() => mount(Comp)).toThrow("No valdres store provided")
    })

    test("looks up store by id", () => {
        const parentStore = createStore()
        const childStore = createStore()
        let result: any
        const Comp = defineComponent({
            setup() {
                result = useStore(parentStore.data.id)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp, {
            global: {
                provide: {
                    [ValdresKey as symbol]: {
                        current: childStore,
                        stores: {
                            [parentStore.data.id]: parentStore,
                            [childStore.data.id]: childStore,
                        },
                    },
                },
            },
        })
        expect(result.data.id).toBe(parentStore.data.id)
    })

    test("throws for unknown store id", () => {
        const storeInstance = createStore()
        const Comp = defineComponent({
            setup() {
                useStore("nonexistent")
                return {}
            },
            template: "<div></div>",
        })
        expect(() =>
            mount(Comp, {
                global: {
                    provide: provideStore(storeInstance),
                },
            }),
        ).toThrow('No store with id "nonexistent" found')
    })
})
