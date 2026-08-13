import { describe, expect, test } from "bun:test"
import { familyKey } from "./familyKey"
import { stableStringify } from "./stableStringify"
import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

describe("stableStringify", () => {
    test("keeps non-string primitives on the family-key hot path", () => {
        expect(stableStringify("user-1")).toBe("user-1")
        expect(stableStringify(1)).toBe(1)
        expect(stableStringify(true)).toBe(true)
        expect(familyKey([1])).toBe(1)
        expect(familyKey([true])).toBe(true)
        expect(familyKey([1n])).toBe(1n)
        expect(familyKey(["user-1"])).toBe(stringifyFamilyArgs(["user-1"]))
    })

    test("keeps BigInt distinct from strings in legacy stable keys", () => {
        expect(stableStringify(1n)).not.toBe(stableStringify("1"))
        expect(stableStringify({ value: 1n })).not.toBe(
            stableStringify({ value: "1n" }),
        )
    })

    test("serializes Maps in stable key order", () => {
        const a = new Map<any, any>([
            ["b", 2],
            ["a", 1],
            [{ z: 3, y: 2 }, new Set([3, 1, 2])],
        ])
        const b = new Map<any, any>([
            [{ y: 2, z: 3 }, new Set([2, 3, 1])],
            ["a", 1],
            ["b", 2],
        ])

        expect(stableStringify(a)).toBe(stableStringify(b))
    })

    test("serializes Sets in stable value order", () => {
        expect(stableStringify(new Set([3, 1, 2]))).toBe(
            stableStringify(new Set([2, 3, 1])),
        )
    })

    test("does not collide Map, Set, Array, object, and string-shaped keys", () => {
        const objectLikeMap = new Map<any, any>([[{ id: 1 }, "value"]])
        const stringLikeMap = new Map<any, any>([[`{"id":1}`, "value"]])

        expect(stableStringify(objectLikeMap)).not.toBe(
            stableStringify(stringLikeMap),
        )
        expect(stableStringify(new Map([["a", 1]]))).not.toBe(
            stableStringify({ a: 1 }),
        )
        expect(stableStringify(new Set([1, 2]))).not.toBe(
            stableStringify([1, 2]),
        )
    })

    test("family keys are stable for nested structured arguments", () => {
        const a = {
            meta: new Map<any, any>([
                [{ b: 2, a: 1 }, new Set(["z", "a"])],
                ["tags", new Set([2, 1])],
            ]),
            object: { y: 2, x: 1 },
        }
        const b = {
            object: { x: 1, y: 2 },
            meta: new Map<any, any>([
                ["tags", new Set([1, 2])],
                [{ a: 1, b: 2 }, new Set(["a", "z"])],
            ]),
        }

        expect(familyKey([a])).toBe(familyKey([b]))
        expect(stringifyFamilyArgs([a])).toBe(stringifyFamilyArgs([b]))
    })

    test("family keys distinguish raw strings, structured values, and arity", () => {
        expect(familyKey(["{}"])).not.toBe(familyKey([{}]))
        expect(familyKey(["[]"])).not.toBe(familyKey([[]]))
        expect(familyKey([[1, 2]])).not.toBe(familyKey([1, 2]))
        expect(familyKey([])).not.toBe(familyKey([undefined]))
    })

    test("family keys encode BigInt without colliding with other primitives", () => {
        expect(familyKey([1n])).toBe(familyKey([1n]))
        expect(familyKey([{ value: 1n }])).toBe(familyKey([{ value: 1n }]))
        expect(familyKey([1n])).not.toBe(familyKey([1]))
        expect(familyKey([1n])).not.toBe(familyKey(["1"]))
    })

    test("family keys preserve supported value distinctions", () => {
        const sparse = Array(1)
        const values = [
            familyKey([0]),
            familyKey([-0]),
            familyKey(["0"]),
            familyKey([0n]),
            familyKey([false]),
            familyKey([null]),
            familyKey([undefined]),
            familyKey([new Date(0)]),
            familyKey([{}]),
            familyKey([Object.create(null)]),
            familyKey([{ value: undefined }]),
            familyKey([sparse]),
            familyKey([[undefined]]),
        ]

        expect(new Set(values).size).toBe(values.length)
        expect(familyKey([NaN])).toBe(familyKey([NaN]))
        expect(familyKey([new Date(0)])).toBe(familyKey([new Date(0)]))
    })

    test("family keys reflect mutations instead of caching stale structure", () => {
        const value = { id: 1 }
        const before = familyKey([value])
        value.id = 2
        expect(familyKey([value])).not.toBe(before)
    })

    test("family keys reject values without deterministic structural semantics", () => {
        class ArraySubclass extends Array {}
        class MapSubclass extends Map {}
        class SetSubclass extends Set {}
        class DateSubclass extends Date {}
        const cyclic: Record<string, unknown> = {}
        cyclic.self = cyclic
        let getterCalls = 0
        const accessor = Object.defineProperty({}, "value", {
            enumerable: true,
            get: () => {
                getterCalls++
                return 1
            },
        })
        const hidden = Object.defineProperty({}, "value", { value: 1 })
        const symbolKeyed = Object.defineProperty({}, Symbol("value"), {
            value: 1,
        })

        expect(() => familyKey([Symbol("same")])).toThrow(TypeError)
        expect(() => familyKey([Symbol("same")])).toThrow("symbol")
        expect(() => familyKey([Promise.resolve()])).toThrow(TypeError)
        expect(() => familyKey([() => undefined])).toThrow(TypeError)
        expect(() => familyKey([new WeakMap()])).toThrow(TypeError)
        expect(() => familyKey([new (class Unsupported {})()])).toThrow(
            TypeError,
        )
        expect(() => familyKey([new ArraySubclass()])).toThrow(TypeError)
        expect(() => familyKey([new MapSubclass()])).toThrow(TypeError)
        expect(() => familyKey([new SetSubclass()])).toThrow(TypeError)
        expect(() => familyKey([new DateSubclass()])).toThrow(TypeError)
        expect(() => familyKey([accessor])).toThrow(TypeError)
        expect(getterCalls).toBe(0)
        expect(() => familyKey([hidden])).toThrow(TypeError)
        expect(() => familyKey([symbolKeyed])).toThrow(TypeError)
        expect(() => familyKey([cyclic])).toThrow(TypeError)
        expect(() => familyKey([cyclic])).toThrow(
            "valdres: cyclic family key values are not supported",
        )
    })
})
