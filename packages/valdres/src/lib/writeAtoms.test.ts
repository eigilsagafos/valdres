import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import { getStoreData } from "./getStoreData"

describe("writeAtoms equal-value branch", () => {
    test("txn.set of a deep-equal object preserves the stored reference like a direct set", () => {
        const rootStore = store()
        const original = { a: 1 }
        const source = atom(original)

        rootStore.set(source, { a: 1 })
        expect(rootStore.get(source)).toBe(original)

        rootStore.txn(({ set }) => set(source, { a: 1 }))
        expect(rootStore.get(source)).toBe(original)
    })

    test("an equal-value txn write does not bump tree.revision or re-evaluate a cold selector", () => {
        const rootStore = store()
        const source = atom(1)
        const callback = mock(get => ({ value: get(source) }))
        const derived = selector(callback)

        const first = rootStore.get(derived)
        expect(callback).toHaveBeenCalledTimes(1)

        rootStore.txn(({ set }) => set(source, 1))

        expect(getStoreData(rootStore).tree.revision).toBe(0)
        expect(rootStore.get(derived)).toBe(first)
        expect(callback).toHaveBeenCalledTimes(1)
    })
})
