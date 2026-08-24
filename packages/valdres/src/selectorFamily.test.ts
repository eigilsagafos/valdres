import { describe, test, expect } from "bun:test"
import { store } from "./store"
import { selectorFamily } from "./selectorFamily"
import { atom } from "./atom"
import { wait } from "../test/utils/wait"
import { selector } from "./selector"

describe("selectorFamily", () => {
    test("the family object is a factory, not enumerable state", () => {
        const family = selectorFamily((id: string) => () => id, {
            name: "invalid-state-selector-family",
        })
        family("one")
        const rootStore = store()

        expect(() => rootStore.get(family as any)).toThrow(
            "valdres: invalid object 'invalid-state-selector-family' passed to get()",
        )
        expect(() => rootStore.sub(family as any, () => {})).toThrow(
            "valdres: invalid object 'invalid-state-selector-family' passed to sub()",
        )
    })

    test("throws if a member factory returns an async function", () => {
        const family = selectorFamily((id: number) => async () => id)

        expect(() => family(1)).toThrow(
            "valdres: selectorFamily() does not accept async functions",
        )
    })

    test("the same selector is returned for the same family arguments", () => {
        const nameSelectorFamily2 = selectorFamily(() => () => null)
        nameSelectorFamily2(1)

        const nameSelectorFamily = selectorFamily((id: number) => () => null)
        expect(nameSelectorFamily(1)).toEqual(nameSelectorFamily(1))
    })

    test("mutable option is inherited by members", () => {
        const family = selectorFamily(() => () => new Map<string, number>(), {
            mutable: true,
        })

        expect(family("one").mutable).toBe(true)
        expect(() => store().get(family("one")).set("value", 1)).not.toThrow()
    })

    test("name", () => {
        const family = selectorFamily(() => () => null, { name: "familyName" })
        expect(family.name).toBe("familyName")
        expect(family(1).name).toBe("familyName_1")
        expect(family("2").name).toBe("familyName_2")
        const structured = family({ id: 3 })
        expect(structured.name).toBe(
            `familyName_${structured.familyArgsStringified.toString()}`,
        )
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
            (key: number) => () => wait(1).then(() => "done"),
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
        const keys = new WeakMap<object, number>()
        let nextKey = 0
        const testFamily = selectorFamily(atom => get => get(atom), {
            keyOf: atom => {
                let key = keys.get(atom)
                if (key === undefined) {
                    key = ++nextKey
                    keys.set(atom, key)
                }
                return key
            },
        })

        expect(testFamily(atom1)).toStrictEqual(testFamily(atom1))
        expect(store1.get(testFamily(atom1))).toEqual(1)
        store1.set(atom1, 2)
        expect(store1.get(testFamily(atom1))).toEqual(2)
    })

    test("selector as arg", async () => {
        const store1 = store()
        const selector1 = selector(() => "Foo")
        const testFamily = selectorFamily(selector => get => get(selector1), {
            keyOf: () => "selector1",
        })
        expect(store1.get(testFamily(selector1))).toEqual("Foo")
        expect(testFamily(selector1)).toStrictEqual(testFamily(selector1))
    })

    test("structured keys use stable Map, Set, object, and nested args", () => {
        const store1 = store()
        const family = selectorFamily<string, [unknown]>(() => () => "value")

        const mapA = new Map<any, any>([
            ["b", 2],
            ["a", 1],
        ])
        const mapB = new Map<any, any>([
            ["a", 1],
            ["b", 2],
        ])
        expect(family(mapA)).toBe(family(mapB))

        const setA = new Set([3, 1, 2])
        const setB = new Set([2, 3, 1])
        expect(family(setA)).toBe(family(setB))

        expect(family({ b: 2, a: 1 })).toBe(family({ a: 1, b: 2 }))

        const nestedA = {
            meta: new Map<any, any>([
                [{ b: 2, a: 1 }, new Set(["z", "a"])],
                ["tags", new Set([2, 1])],
            ]),
        }
        const nestedB = {
            meta: new Map<any, any>([
                ["tags", new Set([1, 2])],
                [{ a: 1, b: 2 }, new Set(["a", "z"])],
            ]),
        }
        expect(family(nestedA)).toBe(family(nestedB))
        expect(store1.get(family(nestedB))).toBe("value")
    })

    test("structured keys avoid Map and Set collisions", () => {
        const store1 = store()
        const objectKeyMap = new Map<any, any>([[{ id: 1 }, "value"]])
        const stringKeyMap = new Map<any, any>([[`{"id":1}`, "value"]])
        const mapAsObject = new Map<any, any>([["a", 1]])
        const object = { a: 1 }
        const set = new Set([1, 2])
        const array = [1, 2]
        const family = selectorFamily<string, [unknown]>(key => () => {
            if (key === objectKeyMap) return "object-map"
            if (key === stringKeyMap) return "string-map"
            if (key === mapAsObject) return "map"
            if (key === object) return "object"
            if (key === set) return "set"
            if (key === array) return "array"
            return "unknown"
        })

        expect(family(objectKeyMap)).not.toBe(family(stringKeyMap))
        expect(family(mapAsObject)).not.toBe(family(object))
        expect(family(set)).not.toBe(family(array))

        expect(store1.get(family(objectKeyMap))).toBe("object-map")
        expect(store1.get(family(stringKeyMap))).toBe("string-map")
        expect(store1.get(family(mapAsObject))).toBe("map")
        expect(store1.get(family(object))).toBe("object")
        expect(store1.get(family(set))).toBe("set")
        expect(store1.get(family(array))).toBe("array")
    })

    test("selectorFamily keyOf defines cache identity", () => {
        const family = selectorFamily<
            string,
            [{ id: string; revision: number }]
        >(entity => () => `${entity.id}:${entity.revision}`, {
            keyOf: entity => entity.id,
        })

        const first = family({ id: "a", revision: 1 })
        expect(family({ id: "a", revision: 2 })).toBe(first)
        expect("keyOf" in first).toBe(false)
        family.release({ id: "a", revision: 3 })
        expect(family({ id: "a", revision: 4 })).not.toBe(first)
    })

    test("selectorFamily release clears canonical and string caches", () => {
        const family = selectorFamily<string, [string]>(id => () => id)
        const first = family("a")

        family.release("a")

        expect(family("a")).not.toBe(first)
    })

    test("every argument shape resolves to one stable, distinct member", () => {
        // The accessor derives its cache key down four arity branches — a raw
        // string via the side cache, a single non-string primitive used AS the
        // map key, a one/two-element array literal, and a copy of `arguments`
        // for anything wider. They must agree with familyKey() on both halves
        // of cache identity: repeat calls return the SAME member, and arguments
        // that are not the same key return DIFFERENT ones.
        const family = selectorFamily(
            (...args: any[]) =>
                () =>
                    args.length,
        )
        const shapes: any[][] = [
            [],
            ["a"],
            [""],
            // a raw string that looks like an encoded key must not collide with
            // the value it encodes
            ["s1:a"],
            [0],
            [-0],
            [1],
            [NaN],
            [Infinity],
            [true],
            [false],
            [10n],
            [null],
            [undefined],
            [{ id: "x" }],
            [[1, 2]],
            ["a", 1],
            ["a", 2],
            [1, 2],
            ["a", 1, 2],
            [1, 2, 3, 4, 5],
        ]
        const members = shapes.map(args => family(...(args as [any])))

        // stable
        shapes.forEach((args, index) => {
            expect(family(...(args as [any]))).toBe(members[index])
        })
        // distinct — including +0 vs -0, which SameValueZero would merge
        expect(new Set(members).size).toBe(shapes.length)
        // and each member reports the key it was actually filed under
        shapes.forEach((args, index) => {
            expect(members[index]!.familyArgs).toEqual(args as [any])
        })
    })

    test("a keyed family forwards the whole argument tuple", () => {
        // A family with keyOf gets its own accessor, which assembles the
        // argument array down the same arity branches as the unkeyed one. Both
        // keyOf and the member factory must receive every argument: a branch
        // that dropped one would hand keyOf a short tuple, and calls that
        // differ only in a dropped position would silently collapse onto a
        // single member.
        const keyOfCalls: any[][] = []
        const factoryCalls: any[][] = []
        const family = selectorFamily(
            (...args: any[]) => {
                factoryCalls.push(args)
                return () => args.length
            },
            {
                keyOf: (...args: any[]) => {
                    keyOfCalls.push(args)
                    return JSON.stringify(args)
                },
            },
        )
        const shapes: any[][] = [
            [],
            ["a"],
            ["a", 1],
            // differs from the previous shape only in the LAST argument, so a
            // truncating branch would merge the two
            ["a", 2],
            ["a", 1, 2],
            [1, 2, 3, 4, 5],
        ]

        const members = shapes.map((args, index) => {
            const member = family(...(args as [any]))
            expect(keyOfCalls[keyOfCalls.length - 1]).toEqual(args)
            expect(factoryCalls[index]).toEqual(args)
            return member
        })

        shapes.forEach((args, index) => {
            expect(family(...(args as [any]))).toBe(members[index])
        })
        expect(new Set(members).size).toBe(shapes.length)
        // the member keeps the ORIGINAL arguments, not the projected key
        shapes.forEach((args, index) => {
            expect(members[index]!.familyArgs).toEqual(args as [any])
        })
        // a cache hit still re-runs keyOf (it is what produces the key) but
        // must not re-run the factory
        expect(factoryCalls.length).toBe(shapes.length)
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
