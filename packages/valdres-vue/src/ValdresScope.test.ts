import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent, h } from "vue"
import { atom, store as createStore } from "valdres"
import { ValdresScope } from "./ValdresScope"
import { createValdres } from "./createValdres"
import { useValue } from "./useValue"
import { useStore } from "./useStore"

describe("ValdresScope", () => {
    test("state flows from parent until set in scope", async () => {
        const nameAtom = atom("default")
        const rootStore = createStore({ batchUpdates: true })

        let ref: any
        const Child = defineComponent({
            setup() {
                ref = useValue(nameAtom)
                return () => h("div")
            },
        })

        mount(
            defineComponent({
                setup() {
                    return () =>
                        h(ValdresScope, { scopeId: "child" }, () => h(Child))
                },
            }),
            {
                global: {
                    plugins: [createValdres({ store: rootStore })],
                },
            },
        )

        expect(ref.value).toBe("default")

        rootStore.set(nameAtom, "root")
        await new Promise(r => queueMicrotask(r))
        expect(ref.value).toBe("root")

        const scopedStore = rootStore.scope("child")
        scopedStore.set(nameAtom, "scoped")
        await new Promise(r => queueMicrotask(r))
        expect(ref.value).toBe("scoped")
    })

    test("scope is released on unmount", () => {
        const rootStore = createStore({ batchUpdates: true })

        const wrapper = mount(
            defineComponent({
                setup() {
                    return () => h(ValdresScope, { scopeId: "temp" }, () => h("div"))
                },
            }),
            {
                global: {
                    plugins: [createValdres({ store: rootStore })],
                },
            },
        )

        expect([...rootStore.data.scopes.keys()]).toStrictEqual(["temp"])
        wrapper.unmount()
        expect([...rootStore.data.scopes.keys()]).toStrictEqual([])
    })

    test("initialize with array return", () => {
        const atom1 = atom(1)
        const atom2 = atom(2)
        const rootStore = createStore({ batchUpdates: true })

        let ref1: any
        let ref2: any
        const Child = defineComponent({
            setup() {
                ref1 = useValue(atom1)
                ref2 = useValue(atom2)
                return () => h("div")
            },
        })

        mount(
            defineComponent({
                setup() {
                    return () =>
                        h(
                            ValdresScope,
                            {
                                scopeId: "init",
                                initialize: () => [
                                    [atom1, 10],
                                    [atom2, 20],
                                ],
                            },
                            () => h(Child),
                        )
                },
            }),
            {
                global: {
                    plugins: [createValdres({ store: rootStore })],
                },
            },
        )

        expect(ref1.value).toBe(10)
        expect(ref2.value).toBe(20)
    })

    test("initialize with txn.set", () => {
        const countAtom = atom(0)
        const rootStore = createStore({ batchUpdates: true })

        let ref: any
        const Child = defineComponent({
            setup() {
                ref = useValue(countAtom)
                return () => h("div")
            },
        })

        mount(
            defineComponent({
                setup() {
                    return () =>
                        h(
                            ValdresScope,
                            {
                                scopeId: "txn-init",
                                initialize: (txn: any) => {
                                    txn.set(countAtom, 42)
                                },
                            },
                            () => h(Child),
                        )
                },
            }),
            {
                global: {
                    plugins: [createValdres({ store: rootStore })],
                },
            },
        )

        expect(ref.value).toBe(42)
    })

    test("useStore(id) accesses parent store from within scope", () => {
        const rootStore = createStore({ batchUpdates: true })
        const rootId = rootStore.data.id

        let scopedStoreResult: any
        let parentStoreResult: any
        const Child = defineComponent({
            setup() {
                scopedStoreResult = useStore()
                parentStoreResult = useStore(rootId)
                return () => h("div")
            },
        })

        mount(
            defineComponent({
                setup() {
                    return () =>
                        h(ValdresScope, { scopeId: "nested" }, () => h(Child))
                },
            }),
            {
                global: {
                    plugins: [createValdres({ store: rootStore })],
                },
            },
        )

        expect(scopedStoreResult.data.id).not.toBe(rootId)
        expect(parentStoreResult.data.id).toBe(rootId)
    })

    test("scoped set does not leak to parent", async () => {
        const nameAtom = atom("default")
        const rootStore = createStore({ batchUpdates: true })

        let parentRef: any
        let scopedRef: any
        const ScopedChild = defineComponent({
            setup() {
                scopedRef = useValue(nameAtom)
                return () => h("div")
            },
        })
        const ParentChild = defineComponent({
            setup() {
                parentRef = useValue(nameAtom)
                return () => h("div")
            },
        })

        mount(
            defineComponent({
                setup() {
                    return () => [
                        h(ParentChild),
                        h(ValdresScope, { scopeId: "isolated" }, () =>
                            h(ScopedChild),
                        ),
                    ]
                },
            }),
            {
                global: {
                    plugins: [createValdres({ store: rootStore })],
                },
            },
        )

        expect(parentRef.value).toBe("default")
        expect(scopedRef.value).toBe("default")

        // Set in scope should not affect parent
        const scopedStore = rootStore.scope("isolated")
        scopedStore.set(nameAtom, "scoped-only")
        await new Promise(r => queueMicrotask(r))
        expect(scopedRef.value).toBe("scoped-only")
        expect(parentRef.value).toBe("default")
    })

    test("nested scopes build up store chain", () => {
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

        mount(
            defineComponent({
                setup() {
                    return () =>
                        h(ValdresScope, { scopeId: "outer" }, () =>
                            h(ValdresScope, { scopeId: "inner" }, () =>
                                h(Inner),
                            ),
                        )
                },
            }),
            {
                global: {
                    plugins: [createValdres({ store: rootStore })],
                },
            },
        )

        expect(innerStore.data.id).not.toBe(rootId)
        expect(rootFromInner.data.id).toBe(rootId)
    })
})
