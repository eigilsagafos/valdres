import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../createStore"
import { selector } from "./selector"
import { atom } from "./atom"

describe("recoil/atom", () => {
    test("simple", () => {
        const a = atom({ key: "Foo" })
        // const store = createStore()
        // const selector1 = selector({
        //     key: "Foo",
        //     get: () => 1
        // })
        // expect(store.get(selector1)).toBe(1)
    })
})
