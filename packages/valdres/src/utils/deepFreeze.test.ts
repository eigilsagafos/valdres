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
    test("freezes a Promise surface without blocking settlement", async () => {
        const promise = Promise.resolve({ ok: true })

        expect(deepFreeze(promise)).toBe(promise)
        expect(Object.isFrozen(promise)).toBe(true)
        expect(await promise).toEqual({ ok: true })
    })
    test("freezes an Error's own property graph", () => {
        const error = Object.assign(new Error("failure"), {
            details: { retryable: true },
        })

        expect(deepFreeze(error)).toBe(error)
        expect(Object.isFrozen(error)).toBe(true)
        expect(Object.isFrozen(error.details)).toBe(true)
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

    test.each([
        ["Map", Object.freeze(new Map([["key", "value"]]))],
        ["Set", Object.freeze(new Set(["value"]))],
        ["WeakMap", new WeakMap([[{}, "value"]])],
        ["WeakSet", new WeakSet([{}])],
        ["ArrayBuffer", new ArrayBuffer(1)],
        ["DataView", new DataView(new ArrayBuffer(1))],
        ["Uint8Array", new Uint8Array([1])],
        ["Date", new Date(0)],
        ["RegExp", /mutable/g],
    ])("rejects mutable %s values with an actionable error", (_name, value) => {
        expect(() => deepFreeze(value)).toThrow(
            /valdres: deepFreeze cannot make .*\{ mutable: true \}/,
        )
    })

    test("rejects unsupported values nested in otherwise freezable data", () => {
        const value = { metadata: { tags: new Set(["one"]) } }

        expect(() => deepFreeze(value)).toThrow(/\{ mutable: true \}/)
        expect(Object.isFrozen(value)).toBe(false)
    })

    test("checks unsupported children inside an already-frozen container", () => {
        const value = Object.freeze({ tags: new Set(["one"]) })

        expect(() => deepFreeze(value)).toThrow(/\{ mutable: true \}/)
    })

    test("freezes the own-property graph of ordinary class instances", () => {
        class Circular {
            self = this
        }

        const value = deepFreeze(new Circular())
        expect(Object.isFrozen(value)).toBe(true)
        expect(value.self).toBe(value)
    })
})
