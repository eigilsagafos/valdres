import { describe, test, expect } from "bun:test"
import { mount } from "@vue/test-utils"
import { defineComponent } from "vue"
import { atom, atomFamily, dehydrate, store as createStore } from "valdres"
import { createValdres } from "./createValdres"
import { useStore } from "./useStore"
import { useValue } from "./useValue"

describe("createValdres", () => {
    test("returns a { install, store } instance", () => {
        const valdres = createValdres()
        expect(typeof valdres.install).toBe("function")
        expect(valdres.store).toBeDefined()
        expect(valdres.store.data.id).toBeDefined()
        // The store is created in the body, before install.
        expect(valdres.store.data.batchUpdates).toBe(true)
    })

    test("install() provides the same store the instance exposes", () => {
        const valdres = createValdres()
        let injected: any
        const Comp = defineComponent({
            setup() {
                injected = useStore()
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp, { global: { plugins: [valdres] } })
        expect(injected.data.id).toBe(valdres.store.data.id)
    })

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
        const storeInstance = createStore({ batchUpdates: true })
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

    test("hydrate applies a dehydrated payload (SSR round-trip)", () => {
        // Named atoms register globally; duplicate names throw process-wide, so
        // use names unique to this test file.
        const userAtom = atom("anon", { name: "vue-test/createValdres/user" })
        const cartFamily = atomFamily((id: string) => 0, {
            name: "vue-test/createValdres/cart",
        })

        // Server: a per-request store, seeded then dehydrated. The txn flushes
        // the batched writes synchronously (on the server they'd flush during
        // render before dehydrate is called).
        const serverStore = createStore({ batchUpdates: true })
        serverStore.txn(txn => {
            txn.set(userAtom, "ada")
            txn.set(cartFamily("apple"), 3)
        })
        const payload = dehydrate(serverStore)

        // Client: a fresh instance hydrated from the payload.
        const valdres = createValdres({ hydrate: payload })
        let userRef: any
        let cartRef: any
        const Comp = defineComponent({
            setup() {
                userRef = useValue(userAtom)
                cartRef = useValue(cartFamily("apple"))
                return {}
            },
            template: "<div></div>",
        })
        mount(Comp, { global: { plugins: [valdres] } })

        expect(userRef.value).toBe("ada")
        expect(cartRef.value).toBe(3)
    })

    test("initialize runs before hydrate (hydrated values win)", () => {
        const flagAtom = atom("default", {
            name: "vue-test/createValdres/flag",
        })
        const serverStore = createStore({ batchUpdates: true })
        serverStore.txn(txn => {
            txn.set(flagAtom, "from-server")
        })
        const payload = dehydrate(serverStore)

        const valdres = createValdres({
            initialize: txn => {
                txn.set(flagAtom, "from-initialize")
            },
            hydrate: payload,
        })
        expect(valdres.store.get(flagAtom)).toBe("from-server")
    })
})
