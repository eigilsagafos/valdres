import { describe, expect, test } from "bun:test"
import { deepFreeze } from "./deepFreeze"

describe("deepFreeze", () => {
    test("null", () => {
        deepFreeze(null)
    })
    test("undefined", () => {
        deepFreeze(undefined)
    })
    test("primitives pass through", () => {
        expect(deepFreeze(1)).toBe(1)
        expect(deepFreeze("a")).toBe("a")
    })
    test("freezes a flat object (no WeakSet needed)", () => {
        const obj = deepFreeze({ title: "a", body: "b" })
        expect(Object.isFrozen(obj)).toBe(true)
    })
    test("freezes nested objects deeply", () => {
        const obj = deepFreeze({ a: { b: { c: 1 } }, list: [{ x: 1 }] })
        expect(Object.isFrozen(obj)).toBe(true)
        expect(Object.isFrozen(obj.a)).toBe(true)
        expect(Object.isFrozen(obj.a.b)).toBe(true)
        expect(Object.isFrozen(obj.list)).toBe(true)
        expect(Object.isFrozen(obj.list[0])).toBe(true)
    })
    test("handles direct cycles", () => {
        const obj: any = { name: "a" }
        obj.self = obj
        const frozen = deepFreeze(obj)
        expect(Object.isFrozen(frozen)).toBe(true)
        expect(frozen.self).toBe(frozen)
    })
    test("handles deeper cycles (child -> grandchild -> child)", () => {
        const child: any = { kind: "child" }
        const grandchild: any = { kind: "grandchild", backToChild: child }
        child.grandchild = grandchild
        const root = deepFreeze({ child })
        expect(Object.isFrozen(root)).toBe(true)
        expect(Object.isFrozen(child)).toBe(true)
        expect(Object.isFrozen(grandchild)).toBe(true)
    })
})
