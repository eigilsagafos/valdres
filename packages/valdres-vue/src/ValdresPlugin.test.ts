import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { atom, store as createStore } from "valdres"
import { createValdres } from "./ValdresPlugin"
import { useStore } from "./useStore"
import { useValue } from "./useValue"

describe("createValdres", () => {
    test("provides store to components", () => {
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
                plugins: [createValdres()],
            },
        })
        expect(result).toBeDefined()
        expect(result.data.id).toBeDefined()
    })

    test("accepts existing store", () => {
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
                plugins: [createValdres({ store: storeInstance })],
            },
        })
        expect(result.data.id).toBe(storeInstance.data.id)
    })

    test("initialize with array return", () => {
        const countAtom = atom(0)
        let ref: any
        const Comp = defineComponent({
            setup() {
                ref = useValue(countAtom)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp, {
            global: {
                plugins: [
                    createValdres({
                        initialize: () => [[countAtom, 42]],
                    }),
                ],
            },
        })
        expect(ref.value).toBe(42)
    })

    test("initialize with txn.set", () => {
        const countAtom = atom(0)
        let ref: any
        const Comp = defineComponent({
            setup() {
                ref = useValue(countAtom)
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp, {
            global: {
                plugins: [
                    createValdres({
                        initialize: (txn: any) => {
                            txn.set(countAtom, 99)
                        },
                    }),
                ],
            },
        })
        expect(ref.value).toBe(99)
    })
})
