import { describe, test, expect } from "bun:test"
import { store } from "./store"
import { selectorFamily } from "./selectorFamily"
import { atom } from "./atom"
import { wait } from "../test/utils/wait"
import { selector } from "./selector"

describe("selectorFamily", () => {
    test("the same atom is returned when calling atomFamily", () => {
        const nameSelectorFamily = selectorFamily(() => null)
        expect(nameSelectorFamily(1)).toEqual(nameSelectorFamily(1))
    })

    test("defaultValue", () => {
        const store1 = store()
        const usersAtom = atom(["Foo", "Bar"])
        const nameSelectorFamily = selectorFamily(key => get => {
            return get(usersAtom)[key]
        })
        const user0 = store1.get(nameSelectorFamily(0))
        expect(user0).toBe("Foo")
    })

    test("get returns a promise", async () => {
        const store1 = store()
        const nameSelectorFamily = selectorFamily<string, number>(
            () => () => wait(1).then(() => "done"),
        )

        const res = store1.get(nameSelectorFamily(1))
        expect(res).toBeInstanceOf(Promise)
        const resolved = await res
        expect(resolved).toBe("done")
        expect(store1.get(nameSelectorFamily(1))).toBe("done")
    })

    test("atom as arg", async () => {
        const store1 = store()
        const atom1 = atom(1)
        const testFamily = selectorFamily(atom => get => get(atom))

        expect(testFamily(atom1)).toStrictEqual(testFamily(atom1))
        expect(store1.get(testFamily(atom1))).toEqual(1)
        store1.set(atom1, 2)
        expect(store1.get(testFamily(atom1))).toEqual(2)
    })

    test("selector as arg", async () => {
        const store1 = store()
        const selector1 = selector(() => "Foo")
        const testFamily = selectorFamily(selector => get => get(selector1))
        expect(store1.get(testFamily(selector1))).toEqual("Foo")
        expect(testFamily(selector1)).toStrictEqual(testFamily(selector1))
    })
})
