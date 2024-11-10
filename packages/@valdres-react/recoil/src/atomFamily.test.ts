import { describe, test, expect } from "bun:test"
import { store } from "valdres"
import { atomFamily } from "./atomFamily"

describe("recoil/atomFamily", () => {
    test("simple", () => {
        const storeA = store()
        const family = atomFamily({ default: null, key: "Fam" })
        const user = family({ id: "1" })
        expect(storeA.get(user)).toBe(null)
    })

    test.only("default callback", () => {
        const storeA = store()
        const family = atomFamily({
            key: "Fam",
            default: arg => {
                return [arg]
            },
        })
        const atom1 = family({ ref: `Foo` })
        console.log(storeA.get(atom1))
    })
})
