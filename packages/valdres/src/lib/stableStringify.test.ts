import { describe, expect, test } from "bun:test"
import { familyKey } from "./familyKey"
import { stableStringify } from "./stableStringify"
import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

describe("stableStringify", () => {
    test("keeps primitive values on the family-key hot path", () => {
        expect(stableStringify("user-1")).toBe("user-1")
        expect(stableStringify(1)).toBe(1)
        expect(stableStringify(true)).toBe(true)
        expect(familyKey(["user-1"])).toBe("user-1")
        expect(stringifyFamilyArgs(["user-1"])).toBe("user-1")
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
})
