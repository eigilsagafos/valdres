import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"
import { wait } from "../../test/utils/wait"
import { initAtom } from "./initAtom"
import { setAtom } from "./setAtom"

describe("StoreContext", () => {
    test("set with direct value", () => {
        // const store = createStore()
        // const numberAtom = atom(1)
        // expect(store.values.get(numberAtom)).toBeUndefined()
        // setAtom(numberAtom, 2, store)
        // expect(store.values.get(numberAtom)).toBe(2)
    })
})
