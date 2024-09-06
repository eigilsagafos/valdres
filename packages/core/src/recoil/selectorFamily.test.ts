import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"
import { selectorFamily } from "./selectorFamily"
import { atomFamily } from "./atomFamily"
// import { atom } from './atom'
// import { createStore } from './createStore'
// import { wait } from '../test/utils/wait'

describe("recoil/selectorFamily", () => {
    test("simple", () => {
        const store = createStore()
        const atom1 = atom(1)
        const fam = selectorFamily({
            get:
                (key) =>
                ({ get }) => {
                    return [key, get(atom1)]
                },
            key: "TestDam",
        })

        const selector1 = fam("Foo")
        expect(store.get(selector1)).toStrictEqual(["Foo", 1])
    })

    test("Complex key", () => {
        const store = createStore()
        const fam = selectorFamily({
            get:
                ({ id, ts }) =>
                ({ get }) => [id, ts],
            key: "Foo",
        })

        const user1 = fam({ id: 1, ts: 0 })
        const user2 = fam({ id: 2, ts: 0 })
        expect(fam({ id: 1, ts: 0 })).toBe(fam({ id: 1, ts: 0 }))

        console.log(store.get(user1))
        console.log(store.get(user2))
    })

    test.only("SelectorFamily with state from atomFamily", () => {
        const store = createStore()
        const atomFam = atomFamily({
            key: "atomFam",
            default: (id) => ({ id, foo: "bar" }),
        })
        const selectorFam = selectorFamily({
            key: "selectorFam",
            get:
                (id) =>
                ({ get }) => [get(atomFam(id))],
        })

        console.log(store.get(selectorFam({ ref: `Foo` })))
    })
})
