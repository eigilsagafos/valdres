import { describe, test, mock, expect } from "bun:test"
import { atom } from "./atom"
import { createStore } from "valdres-react"

describe("recoil/atom", () => {
    test("effects", () => {
        const store = createStore()

        const onSetCallback = mock(() => {})
        const effect = mock(({ onSet, setSelf, storeID, trigger }) => {
            onSet(onSetCallback)
        })
        const atom1 = atom({
            key: "Foo",
            default: 1,
            effects: [effect],
        })

        const unsubscribe = store.sub(atom1, () => {})
        store.set(atom1, 2)
        expect(onSetCallback).toHaveBeenCalledTimes(1)
        expect(onSetCallback).toHaveBeenLastCalledWith(2, 1, false)
        unsubscribe()
        store.set(atom1, 3)
        expect(onSetCallback).toHaveBeenCalledTimes(1)
        expect(onSetCallback).toHaveBeenLastCalledWith(2, 1, false)
        expect(store.data.subscriptions.get(atom1).size).toBe(0)
    })
})
