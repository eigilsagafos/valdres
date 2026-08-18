import { expect, test } from "bun:test"
import { globalAtom } from "./globalAtom"
import { globalStore } from "./globalStore"
import { store } from "./store"
import { uniqueName } from "../test/utils/uniqueName"

test("globalStore cannot be disposed", () => {
    expect(() => globalStore.dispose()).toThrow(
        "valdres: globalStore is process-wide and cannot be disposed",
    )

    const sharedAtom = globalAtom(0, { name: uniqueName("sharedAtom") })
    const writer = store()
    writer.set(sharedAtom, 1)

    expect(sharedAtom.getSelf()).toBe(1)
    expect(store().get(sharedAtom)).toBe(1)
})
