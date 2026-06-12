import { describe, test, expect } from "bun:test"
import { store } from "./store"
import { selectorFamily } from "./selectorFamily"
import { atom } from "./atom"
import { wait } from "../test/utils/wait"
import { selector } from "./selector"

describe("selectorFamily", () => {
    test("the same atom is returned when calling atomFamily", () => {
        const nameSelectorFamily2 = selectorFamily(() => () => null)
        nameSelectorFamily2(1)

        const nameSelectorFamily = selectorFamily((id: number) => () => null)
        expect(nameSelectorFamily(1)).toEqual(nameSelectorFamily(1))
    })

    test("name", () => {
        const family = selectorFamily(() => () => null, { name: "familyName" })
        expect(family.name).toBe("familyName")
        expect(family(1).name).toBe("familyName_1")
        expect(family("2").name).toBe("familyName_2")
    })

    test("unnamed family has name undefined (not the intrinsic 'selectorFamily')", () => {
        const family = selectorFamily(() => () => null)
        expect(family.name).toBeUndefined()
        // Members of an unnamed family keep name undefined too.
        expect(family(1).name).toBeUndefined()
        expect(family("foo").name).toBeUndefined()
    })

    test("a family legitimately named 'selectorFamily' is distinguishable", () => {
        const family = selectorFamily(() => () => null, {
            name: "selectorFamily",
        })
        expect(family.name).toBe("selectorFamily")
        expect(family(1).name).toBe("selectorFamily_1")
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
        const nameSelectorFamily = selectorFamily<string>(
            (key: number) => async () => wait(1).then(() => "done"),
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
    test("factory runs once per cache entry, not per read", () => {
        // The wrapper used to be `(get) => callback(...args)(get)`, which
        // re-invoked the user's factory on every selector evaluation and
        // allocated a fresh inner closure per read. The fix calls the
        // factory once at cache-miss time and stores the inner getter
        // directly. We assert that here by counting factory invocations.
        let factoryCalls = 0
        let innerCalls = 0
        const store1 = store()
        const baseAtom = atom(0)
        const sf = selectorFamily((offset: number) => {
            factoryCalls++
            return get => {
                innerCalls++
                return get(baseAtom) + offset
            }
        })
        const sel = sf(10)
        // Factory called exactly once on cache miss.
        expect(factoryCalls).toBe(1)
        // Initial read + several re-evals via dep change.
        for (let i = 0; i < 50; i++) {
            store1.set(baseAtom, i)
            store1.get(sel)
        }
        // Factory NEVER runs again — proves no per-read wrapper invocation.
        expect(factoryCalls).toBe(1)
        // Inner getter runs once per evaluation as expected.
        expect(innerCalls).toBeGreaterThanOrEqual(50)
        // sel.get is identity-stable across reads.
        expect(sf(10).get).toBe(sel.get)
    })

    test("mutli args", async () => {
        const store1 = store()
        const testFamily1 = selectorFamily(
            (id: string, capitalize: boolean) => get =>
                ({ id, capitalize }) as const,
        )
        const userFamily2 = selectorFamily(
            (id: string) => get => get(testFamily1(id, true)),
        )

        const selector = userFamily2("Foo")

        const res = store1.get(selector)
        expect(store1.get(selector)).toStrictEqual({
            id: "Foo",
            capitalize: true,
        })
    })
})
