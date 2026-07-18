import { expect, test } from "bun:test"
import { atom } from "./atom"
import { globalStore } from "./globalStore"
import { store } from "./store"

test("globalStore cannot be disposed", () => {
    expect(() => globalStore.dispose()).toThrow(
        "globalStore is process-wide and cannot be disposed",
    )

    const sharedAtom = atom(0, { global: true })
    const writer = store()
    writer.set(sharedAtom, 1)

    expect(sharedAtom.getSelf()).toBe(1)
    expect(store().get(sharedAtom)).toBe(1)
})
