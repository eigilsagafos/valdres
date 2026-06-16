import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { atom, store as createStore } from "valdres"
import { provideValdresScope } from "./provideValdresScope"
import { createValdres } from "./createValdres"
import { useValue } from "./useValue"
import { useStore } from "./useStore"

describe("provideValdresScope", () => {
    test("scopes the subtree and descendants read the scoped store", async () => {
        const nameAtom = atom("default")
        const rootStore = createStore({ batchUpdates: true })

        let childRef: any
        const Child = defineComponent({
            setup() {
                childRef = useValue(nameAtom)
                return () => h("div")
            },
        })
        const Provider = defineComponent({
            setup() {
                provideValdresScope({ scopeId: "board" })
                return () => h(Child)
            },
        })

        mount(Provider, {
            global: { plugins: [createValdres({ store: rootStore })] },
        })

        expect(childRef.value).toBe("default")
        rootStore.scope("board").set(nameAtom, "scoped")
        await new Promise(r => queueMicrotask(r))
        expect(childRef.value).toBe("scoped")
    })

    test("returns the scoped store; own component reads it explicitly", () => {
        const countAtom = atom(0)
        const rootStore = createStore({ batchUpdates: true })

        let scoped: any
        let ownRef: any
        const Provider = defineComponent({
            setup() {
                scoped = provideValdresScope({
                    scopeId: "self",
                    initialize: txn => {
                        txn.set(countAtom, 100)
                    },
                })
                // Own inject resolves the PARENT; pass the returned store to read
                // scoped state in this same component.
                ownRef = useValue(countAtom, scoped)
                return () => h("div")
            },
        })

        mount(Provider, {
            global: { plugins: [createValdres({ store: rootStore })] },
        })

        expect(scoped.data.id).not.toBe(rootStore.data.id)
        expect(ownRef.value).toBe(100)
        // Parent store is untouched.
        expect(rootStore.get(countAtom)).toBe(0)
    })

    test("initialize via returned pairs", () => {
        const a = atom(1)
        const b = atom(2)
        const rootStore = createStore({ batchUpdates: true })

        let scoped: any
        const Provider = defineComponent({
            setup() {
                scoped = provideValdresScope({
                    scopeId: "init",
                    initialize: () => [
                        [a, 10],
                        [b, 20],
                    ],
                })
                return () => h("div")
            },
        })
        mount(Provider, {
            global: { plugins: [createValdres({ store: rootStore })] },
        })
        expect(scoped.get(a)).toBe(10)
        expect(scoped.get(b)).toBe(20)
    })

    test("detaches the created scope on unmount", () => {
        const rootStore = createStore({ batchUpdates: true })
        const Provider = defineComponent({
            setup() {
                provideValdresScope({ scopeId: "temp" })
                return () => h("div")
            },
        })
        const wrapper = mount(Provider, {
            global: { plugins: [createValdres({ store: rootStore })] },
        })
        expect([...rootStore.data.scopes.keys()]).toStrictEqual(["temp"])
        wrapper.unmount()
        expect([...rootStore.data.scopes.keys()]).toStrictEqual([])
    })

    test("default scopeId is generated when omitted", () => {
        const rootStore = createStore({ batchUpdates: true })
        let scoped: any
        const Provider = defineComponent({
            setup() {
                scoped = provideValdresScope()
                return () => h("div")
            },
        })
        mount(Provider, {
            global: { plugins: [createValdres({ store: rootStore })] },
        })
        expect(scoped.data.id).not.toBe(rootStore.data.id)
        expect(rootStore.data.scopes.size).toBe(1)
    })

    test("throws without a provided store", () => {
        const Comp = defineComponent({
            setup() {
                provideValdresScope({ scopeId: "x" })
                return () => h("div")
            },
        })
        expect(() => mount(Comp)).toThrow(/No valdres store provided/)
    })

    test("nested scopes expose ancestors via useStore(id)", () => {
        const rootStore = createStore({ batchUpdates: true })
        const rootId = rootStore.data.id
        let innerStore: any
        let rootFromInner: any

        const Inner = defineComponent({
            setup() {
                innerStore = useStore()
                rootFromInner = useStore(rootId)
                return () => h("div")
            },
        })
        const Outer = defineComponent({
            setup() {
                provideValdresScope({ scopeId: "outer" })
                return () => h(Inner)
            },
        })

        mount(Outer, {
            global: { plugins: [createValdres({ store: rootStore })] },
        })
        expect(innerStore.data.id).not.toBe(rootId)
        expect(rootFromInner.data.id).toBe(rootId)
    })
})
