import { describe, test, expect, mock } from "bun:test"
import { createStore } from "valdres-react"
import { atomFamily } from "./atomFamily"

describe("recoil/atomFamily", () => {
    test("simple", () => {
        const store = createStore()
        const family = atomFamily({ default: null, key: "Fam" })
        const user = family({ id: "1" })
        expect(store.get(user)).toBe(null)
    })

    test.only("default callback", () => {
        const store = createStore()
        const family = atomFamily({
            key: "Fam",
            default: arg => {
                return [arg]
            },
        })
        const atom1 = family({ ref: `Foo` })
        console.log(store.get(atom1))
    })
})
