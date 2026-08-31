import { describe, expect, test } from "bun:test"
import { runInNewContext } from "node:vm"
import * as equalityApi from "../../src/equality"
import { deepEqual } from "../../src/equality"
import { atom, selector, store, type EqualFunc } from "../../src/index"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 opt-in structural equality", () => {
    test("exports exactly one two-argument EqualFunc-compatible comparator", () => {
        expect(Object.keys(equalityApi)).toEqual(["deepEqual"])
        expect(deepEqual.length).toBe(2)

        const compareNumbers: EqualFunc<number> = deepEqual
        const compareRecords: EqualFunc<Readonly<{ value: number }>> = deepEqual

        expect(compareNumbers(1, 1)).toBe(true)
        expect(compareRecords({ value: 1 }, { value: 1 })).toBe(true)

        if (false) {
            // @ts-expect-error deepEqual has no legacy Store-provenance argument.
            deepEqual(1, 1, new Set())
        }
    })

    test("uses SameValueZero for primitive leaves and identity for functions and symbols", () => {
        const operation = (): number => 1
        const key = Symbol("key")

        expect(deepEqual(Number.NaN, Number.NaN)).toBe(true)
        expect(deepEqual(0, -0)).toBe(true)
        expect(deepEqual({ value: 0 }, { value: -0 })).toBe(true)
        expect(deepEqual(1n, 1n)).toBe(true)
        expect(deepEqual(null, null)).toBe(true)
        expect(deepEqual(undefined, undefined)).toBe(true)

        expect(deepEqual(1, "1")).toBe(false)
        expect(deepEqual(null, undefined)).toBe(false)
        expect(deepEqual(operation, operation)).toBe(true)
        expect(
            deepEqual(
                (): number => 1,
                (): number => 1,
            ),
        ).toBe(false)
        expect(deepEqual(key, key)).toBe(true)
        expect(deepEqual(Symbol("key"), Symbol("key"))).toBe(false)
    })

    test("compares ordinary objects by exact prototype and own enumerable keys", () => {
        const sharedSymbol = Symbol("shared")
        const otherSymbol = Symbol("shared")

        expect(
            deepEqual(
                { a: 1, nested: { value: 2 }, [sharedSymbol]: { ok: true } },
                { nested: { value: 2 }, a: 1, [sharedSymbol]: { ok: true } },
            ),
        ).toBe(true)
        expect(
            deepEqual(
                { a: 1, nested: { value: 2 } },
                { a: 1, nested: { value: 3 } },
            ),
        ).toBe(false)
        expect(deepEqual({ [sharedSymbol]: 1 }, { [otherSymbol]: 1 })).toBe(
            false,
        )
        expect(deepEqual({ value: 1 }, { value: 1, extra: true })).toBe(false)
        expect(deepEqual({ [sharedSymbol]: 1 }, {})).toBe(false)
        expect(deepEqual({}, { [sharedSymbol]: 1 })).toBe(false)

        const sharedChild = { value: 1 }
        expect(
            deepEqual(
                { first: sharedChild, second: sharedChild },
                { first: { value: 1 }, second: { value: 1 } },
            ),
        ).toBe(true)

        const hiddenLeft = { visible: 1 }
        const hiddenRight = { visible: 1 }
        Object.defineProperty(hiddenLeft, "hidden", { value: 1 })
        Object.defineProperty(hiddenRight, "hidden", { value: 2 })
        Object.defineProperty(hiddenLeft, sharedSymbol, { value: 1 })
        Object.defineProperty(hiddenRight, sharedSymbol, { value: 2 })
        expect(deepEqual(hiddenLeft, hiddenRight)).toBe(true)

        const nullPrototypeLeft = Object.assign(Object.create(null), {
            value: { nested: true },
        })
        const nullPrototypeRight = Object.assign(Object.create(null), {
            value: { nested: true },
        })
        expect(deepEqual(nullPrototypeLeft, nullPrototypeRight)).toBe(true)
        expect(deepEqual(nullPrototypeLeft, { value: { nested: true } })).toBe(
            false,
        )

        const sharedPrototype = Object.freeze({ kind: "record" })
        const samePrototypeLeft = Object.assign(
            Object.create(sharedPrototype),
            { value: 1 },
        )
        const samePrototypeRight = Object.assign(
            Object.create(sharedPrototype),
            { value: 1 },
        )
        const otherPrototype = Object.assign(
            Object.create(Object.freeze({ kind: "record" })),
            { value: 1 },
        )
        expect(deepEqual(samePrototypeLeft, samePrototypeRight)).toBe(true)
        expect(deepEqual(samePrototypeLeft, otherPrototype)).toBe(false)

        class RecordValue {
            constructor(readonly value: number) {}
        }
        class OtherRecordValue {
            constructor(readonly value: number) {}
        }
        expect(deepEqual(new RecordValue(1), new RecordValue(1))).toBe(true)
        expect(deepEqual(new RecordValue(1), new RecordValue(2))).toBe(false)
        expect(deepEqual(new RecordValue(1), new OtherRecordValue(1))).toBe(
            false,
        )

        const foreignObject = runInNewContext("({ value: 1 })")
        expect(deepEqual({ value: 1 }, foreignObject)).toBe(false)
    })

    test("distinguishes array holes and compares enumerable expandos and symbols", () => {
        const tag = Symbol("tag")
        const otherTag = Symbol("tag")
        const sparseLeft = [1, , { value: 3 }]
        const sparseRight = [1, , { value: 3 }]

        expect(deepEqual([1, { value: 2 }], [1, { value: 2 }])).toBe(true)
        expect(deepEqual([1, { value: 2 }], [1, { value: 3 }])).toBe(false)
        expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
        expect(deepEqual(sparseLeft, sparseRight)).toBe(true)
        expect(deepEqual([1, , 3], [1, undefined, 3])).toBe(false)

        const expanded = (cursor: string, symbolValue: number) =>
            Object.assign([1, , 3], {
                cursor,
                [tag]: { value: symbolValue },
            })
        expect(deepEqual(expanded("a", 1), expanded("a", 1))).toBe(true)
        expect(deepEqual(expanded("a", 1), expanded("b", 1))).toBe(false)
        expect(deepEqual(expanded("a", 1), expanded("a", 2))).toBe(false)
        expect(
            deepEqual(
                Object.assign([1, 2], { [tag]: 1 }),
                Object.assign([1, 2], { [otherTag]: 1 }),
            ),
        ).toBe(false)

        const hiddenLeft = [1, 2]
        const hiddenRight = [1, 2]
        Object.defineProperty(hiddenLeft, "hidden", { value: 1 })
        Object.defineProperty(hiddenRight, "hidden", { value: 2 })
        expect(deepEqual(hiddenLeft, hiddenRight)).toBe(true)
    })

    test("keeps Map keys and Set members identity-based while recursing through Map values", () => {
        const sharedKey = { id: 1 }
        const distinctKey = { id: 1 }
        const sharedMember = { id: 2 }

        const left = new Map<unknown, unknown>([
            [sharedKey, { nested: { value: 1 } }],
            [Number.NaN, { label: "nan" }],
            [-0, { label: "zero" }],
        ])
        const reordered = new Map<unknown, unknown>([
            [0, { label: "zero" }],
            [Number.NaN, { label: "nan" }],
            [sharedKey, { nested: { value: 1 } }],
        ])
        expect(deepEqual(left, reordered)).toBe(true)
        expect(deepEqual(left, new Map([[sharedKey, { value: 1 }]]))).toBe(
            false,
        )

        const changedValue = new Map(reordered)
        changedValue.set(sharedKey, { nested: { value: 2 } })
        expect(deepEqual(left, changedValue)).toBe(false)
        expect(
            deepEqual(
                new Map([[sharedKey, { value: 1 }]]),
                new Map([[distinctKey, { value: 1 }]]),
            ),
        ).toBe(false)

        expect(
            deepEqual(
                new Set([sharedMember, Number.NaN, -0]),
                new Set([0, Number.NaN, sharedMember]),
            ),
        ).toBe(true)
        expect(deepEqual(new Set([{ id: 2 }]), new Set([{ id: 2 }]))).toBe(
            false,
        )
        expect(deepEqual(new Set([1]), new Set([1, 2]))).toBe(false)

        const property = Symbol("property")
        const taggedMap = (label: string, symbolValue: number) =>
            Object.assign(new Map([[1, { value: 1 }]]), {
                label,
                [property]: { value: symbolValue },
            })
        const taggedSet = (label: string) =>
            Object.assign(new Set([1]), { label })
        expect(deepEqual(taggedMap("a", 1), taggedMap("a", 1))).toBe(true)
        expect(deepEqual(taggedMap("a", 1), taggedMap("b", 1))).toBe(false)
        expect(deepEqual(taggedMap("a", 1), taggedMap("a", 2))).toBe(false)
        expect(deepEqual(taggedSet("a"), taggedSet("b"))).toBe(false)

        const shadowedMap = (key: number) => {
            const value = new Map([[key, key]])
            Object.defineProperty(value, "keys", {
                value: function* () {},
            })
            return value
        }
        const shadowedSet = (member: number) => {
            const value = new Set([member])
            Object.defineProperty(value, Symbol.iterator, {
                value: function* () {},
            })
            return value
        }
        expect(deepEqual(shadowedMap(1), shadowedMap(2))).toBe(false)
        expect(deepEqual(shadowedSet(1), shadowedSet(2))).toBe(false)
    })

    test("supports dates, regular expressions, boxed primitives, and custom value hooks", () => {
        expect(deepEqual(new Date(1_000), new Date(1_000))).toBe(true)
        expect(deepEqual(new Date(1_000), new Date(2_000))).toBe(false)
        expect(deepEqual(new Date(Number.NaN), new Date(Number.NaN))).toBe(true)
        expect(
            deepEqual(
                Object.assign(new Date(1_000), { zone: "UTC" }),
                Object.assign(new Date(1_000), { zone: "PST" }),
            ),
        ).toBe(false)

        const leftExpression = /value/giu
        const rightExpression = /value/giu
        leftExpression.lastIndex = 4
        rightExpression.lastIndex = 9
        expect(deepEqual(leftExpression, rightExpression)).toBe(true)
        expect(deepEqual(/value/g, /value/i)).toBe(false)
        expect(
            deepEqual(
                Object.assign(/value/g, { label: "a" }),
                Object.assign(/value/g, { label: "b" }),
            ),
        ).toBe(false)

        const shadowedExpression = (expression: RegExp) => {
            Object.defineProperties(expression, {
                source: { value: "same" },
                flags: { value: "" },
                global: { value: false },
            })
            return expression
        }
        expect(
            deepEqual(
                shadowedExpression(/first/g),
                shadowedExpression(/second/i),
            ),
        ).toBe(false)

        expect(deepEqual(new Number(5), new Number(5))).toBe(true)
        expect(deepEqual(new Number(5), new Number(6))).toBe(false)
        expect(deepEqual(new String("a"), new String("a"))).toBe(true)
        expect(deepEqual(new Boolean(true), new Boolean(false))).toBe(false)
        expect(deepEqual(Object(1n), Object(1n))).toBe(true)
        expect(deepEqual(Object(1n), Object(2n))).toBe(false)
        expect(
            deepEqual(Object(Symbol.for("same")), Object(Symbol.for("same"))),
        ).toBe(true)
        expect(deepEqual(Object(Symbol("same")), Object(Symbol("same")))).toBe(
            false,
        )

        const shadowedDate = (time: number) => {
            const value = new Date(time)
            Object.defineProperty(value, "valueOf", { value: () => 0 })
            return value
        }
        const shadowedNumber = (number: number) => {
            const value = new Number(number)
            Object.defineProperty(value, "valueOf", { value: () => 0 })
            return value
        }
        expect(deepEqual(shadowedDate(1), shadowedDate(2))).toBe(false)
        expect(deepEqual(shadowedNumber(1), shadowedNumber(2))).toBe(false)
        class Money {
            constructor(
                readonly amount: number,
                readonly currency: string,
            ) {}
            valueOf(): number {
                return this.amount
            }
        }
        class Label {
            constructor(
                readonly text: string,
                readonly color: string,
            ) {}
            toString(): string {
                return this.text
            }
        }
        expect(deepEqual(new Money(5, "USD"), new Money(5, "USD"))).toBe(true)
        expect(deepEqual(new Money(5, "USD"), new Money(5, "EUR"))).toBe(false)
        expect(deepEqual(new Money(5, "USD"), new Money(6, "USD"))).toBe(false)
        expect(deepEqual(new Label("hi", "red"), new Label("hi", "red"))).toBe(
            true,
        )
        expect(deepEqual(new Label("hi", "red"), new Label("hi", "blue"))).toBe(
            false,
        )
        expect(deepEqual(new Label("hi", "red"), new Label("bye", "red"))).toBe(
            false,
        )
    })

    test("compares binary values by visible bytes across matching realms and brands", () => {
        const leftBuffer = new Uint8Array([0, 1, 2, 255]).buffer
        const sameBuffer = new Uint8Array([0, 1, 2, 255]).buffer
        const differentBuffer = new Uint8Array([0, 1, 3, 255]).buffer
        expect(deepEqual(leftBuffer, sameBuffer)).toBe(true)
        expect(deepEqual(leftBuffer, differentBuffer)).toBe(false)
        expect(deepEqual(leftBuffer, new ArrayBuffer(3))).toBe(false)

        const largeLeft = new Uint8Array(67).fill(7)
        const largeSame = new Uint8Array(largeLeft)
        const differentWord = new Uint8Array(largeLeft)
        const differentTail = new Uint8Array(largeLeft)
        differentWord[32] = 8
        differentTail[66] = 8
        expect(deepEqual(largeLeft.buffer, largeSame.buffer)).toBe(true)
        expect(deepEqual(largeLeft.buffer, differentWord.buffer)).toBe(false)
        expect(deepEqual(largeLeft.buffer, differentTail.buffer)).toBe(false)

        const visibleLeft = new Uint8Array([9, 1, 2, 9]).buffer
        const visibleSame = new Uint8Array([8, 1, 2, 8]).buffer
        const visibleDifferent = new Uint8Array([8, 1, 3, 8]).buffer
        expect(
            deepEqual(
                new DataView(visibleLeft, 1, 2),
                new DataView(visibleSame, 1, 2),
            ),
        ).toBe(true)
        expect(
            deepEqual(
                new DataView(visibleLeft, 1, 2),
                new DataView(visibleDifferent, 1, 2),
            ),
        ).toBe(false)
        expect(
            deepEqual(
                new DataView(visibleLeft, 1, 2),
                new DataView(visibleSame, 1, 1),
            ),
        ).toBe(false)

        expect(
            deepEqual(new Uint16Array([1, 2]), new Uint16Array([1, 2])),
        ).toBe(true)
        expect(
            deepEqual(new Uint16Array([1, 2]), new Uint16Array([1, 3])),
        ).toBe(false)
        expect(deepEqual(new Uint16Array([1, 2]), new Int16Array([1, 2]))).toBe(
            false,
        )

        const positiveZero = new Float32Array([0])
        const negativeZero = new Float32Array([-0])
        Object.defineProperty(positiveZero, Symbol.toStringTag, {
            value: "Uint32Array",
        })
        Object.defineProperty(negativeZero, Symbol.toStringTag, {
            value: "Uint32Array",
        })
        const firstNaN = new Float32Array(new Uint32Array([0x7fc00000]).buffer)
        const sameNaN = new Float32Array(new Uint32Array([0x7fc00000]).buffer)
        const otherNaN = new Float32Array(new Uint32Array([0x7fc00001]).buffer)
        expect(deepEqual(positiveZero, negativeZero)).toBe(false)
        expect(deepEqual(firstNaN, sameNaN)).toBe(true)
        expect(deepEqual(firstNaN, otherNaN)).toBe(false)

        const Float16Array = (
            globalThis as typeof globalThis & {
                readonly Float16Array?: new (
                    buffer: ArrayBufferLike,
                ) => ArrayBufferView
            }
        ).Float16Array
        if (typeof Float16Array === "function") {
            const firstFloat16NaN = new Float16Array(
                new Uint16Array([0x7e00]).buffer,
            )
            const sameFloat16NaN = new Float16Array(
                new Uint16Array([0x7e00]).buffer,
            )
            const otherFloat16NaN = new Float16Array(
                new Uint16Array([0x7e01]).buffer,
            )
            expect(deepEqual(firstFloat16NaN, sameFloat16NaN)).toBe(true)
            expect(deepEqual(firstFloat16NaN, otherFloat16NaN)).toBe(false)
        }

        const tagged = (tag: string) =>
            Object.assign(new Uint8Array([1, 2]), { tag })
        expect(deepEqual(tagged("a"), tagged("b"))).toBe(true)

        if (typeof SharedArrayBuffer === "function") {
            const sharedLeft = new SharedArrayBuffer(3)
            const sharedSame = new SharedArrayBuffer(3)
            const sharedDifferent = new SharedArrayBuffer(3)
            new Uint8Array(sharedLeft).set([1, 2, 3])
            new Uint8Array(sharedSame).set([1, 2, 3])
            new Uint8Array(sharedDifferent).set([1, 2, 4])
            expect(deepEqual(sharedLeft, sharedSame)).toBe(true)
            expect(deepEqual(sharedLeft, sharedDifferent)).toBe(false)
        }

        const foreign = runInNewContext(`({
            buffer: new Uint8Array([1, 2, 3]).buffer,
            view: new DataView(new Uint8Array([9, 1, 2, 9]).buffer, 1, 2),
            typed: new Uint16Array([1, 2, 3]),
        })`) as {
            readonly buffer: ArrayBuffer
            readonly view: DataView
            readonly typed: Uint16Array
        }
        expect(
            deepEqual(new Uint8Array([1, 2, 3]).buffer, foreign.buffer),
        ).toBe(true)
        expect(
            deepEqual(
                new DataView(new Uint8Array([8, 1, 2, 8]).buffer, 1, 2),
                foreign.view,
            ),
        ).toBe(true)
        expect(deepEqual(new Uint16Array([1, 2, 3]), foreign.typed)).toBe(true)
        expect(deepEqual(foreign.typed, new Uint16Array([1, 2, 3]))).toBe(true)

        const foreignBuffers = runInNewContext(`({
            left: new Uint8Array([1, 2, 3]).buffer,
            same: new Uint8Array([1, 2, 3]).buffer,
            different: new Uint8Array([1, 2, 4]).buffer,
        })`) as {
            readonly left: ArrayBuffer
            readonly same: ArrayBuffer
            readonly different: ArrayBuffer
        }
        expect(deepEqual(foreignBuffers.left, foreignBuffers.same)).toBe(true)
        expect(deepEqual(foreignBuffers.left, foreignBuffers.different)).toBe(
            false,
        )

        const foreignTaggedBuffers = runInNewContext(`(() => {
            const make = bytes => {
                const buffer = new Uint8Array(bytes).buffer
                Object.defineProperty(buffer, Symbol.toStringTag, {
                    get() { throw new Error("binary tag must not run") },
                })
                return buffer
            }
            return {
                left: make([1, 2, 3]),
                same: make([1, 2, 3]),
                different: make([1, 2, 4]),
            }
        })()`) as {
            readonly left: ArrayBuffer
            readonly same: ArrayBuffer
            readonly different: ArrayBuffer
        }
        expect(
            deepEqual(foreignTaggedBuffers.left, foreignTaggedBuffers.same),
        ).toBe(true)
        expect(
            deepEqual(
                foreignTaggedBuffers.left,
                foreignTaggedBuffers.different,
            ),
        ).toBe(false)

        const foreignSharedBuffers = runInNewContext(`
            typeof SharedArrayBuffer === "function"
                ? (() => {
                    const make = bytes => {
                        const buffer = new SharedArrayBuffer(bytes.length)
                        new Uint8Array(buffer).set(bytes)
                        Object.defineProperty(buffer, Symbol.toStringTag, {
                            get() { throw new Error("binary tag must not run") },
                        })
                        return buffer
                    }
                    return {
                        left: make([1, 2, 3]),
                        same: make([1, 2, 3]),
                        different: make([1, 2, 4]),
                    }
                })()
                : null
        `) as {
            readonly left: SharedArrayBuffer
            readonly same: SharedArrayBuffer
            readonly different: SharedArrayBuffer
        } | null
        if (foreignSharedBuffers !== null) {
            expect(
                deepEqual(foreignSharedBuffers.left, foreignSharedBuffers.same),
            ).toBe(true)
            expect(
                deepEqual(
                    foreignSharedBuffers.left,
                    foreignSharedBuffers.different,
                ),
            ).toBe(false)
        }

        const fakeLeft = Object.assign(Object.create({}), {
            byteLength: 0,
            [Symbol.toStringTag]: "ArrayBuffer",
        })
        const fakeRight = Object.assign(Object.create({}), {
            byteLength: 0,
            [Symbol.toStringTag]: "ArrayBuffer",
        })
        expect(deepEqual(fakeLeft, fakeRight)).toBe(false)

        const shadowedBuffer = (bytes: readonly number[]) => {
            const value = new Uint8Array(bytes).buffer
            Object.defineProperty(value, "byteLength", { value: 1 })
            return value
        }
        const shadowedView = (byte: number) => {
            const value = new DataView(new Uint8Array([byte]).buffer)
            Object.defineProperty(value, "length", { value: 1 })
            return value
        }
        const shadowedTypedArray = (values: readonly number[]) => {
            const value = new Uint16Array(values)
            Object.defineProperty(value, "length", { value: 1 })
            return value
        }
        expect(deepEqual(shadowedBuffer([1, 2]), shadowedBuffer([1, 3]))).toBe(
            false,
        )
        expect(deepEqual(shadowedView(1), shadowedView(2))).toBe(false)
        expect(
            deepEqual(shadowedTypedArray([1, 2]), shadowedTypedArray([1, 3])),
        ).toBe(false)
    })

    test("treats unsupported opaque objects as identity-only", () => {
        const promise = Promise.resolve(1)
        const otherPromise = Promise.resolve(1)
        expect(deepEqual(promise, promise)).toBe(true)
        expect(deepEqual(promise, otherPromise)).toBe(false)

        const weakKey = {}
        const weakMap = new WeakMap([[weakKey, { value: 1 }]])
        const otherWeakMap = new WeakMap([[weakKey, { value: 1 }]])
        expect(deepEqual(weakMap, weakMap)).toBe(true)
        expect(deepEqual(weakMap, otherWeakMap)).toBe(false)

        const weakSet = new WeakSet([weakKey])
        const otherWeakSet = new WeakSet([weakKey])
        expect(deepEqual(weakSet, weakSet)).toBe(true)
        expect(deepEqual(weakSet, otherWeakSet)).toBe(false)

        const url = new URL("https://example.com/process")
        const otherUrl = new URL("https://example.com/process")
        expect(deepEqual(url, url)).toBe(true)
        expect(deepEqual(url, otherUrl)).toBe(false)
        expect(
            deepEqual(
                Object.assign(url, { label: "same" }),
                Object.assign(otherUrl, { label: "same" }),
            ),
        ).toBe(false)

        const promiseWithObjectTag = (value: number) => {
            const promise = Promise.resolve(value)
            Object.defineProperty(promise, Symbol.toStringTag, {
                value: "Object",
            })
            return promise
        }
        const errorWithObjectTag = (cause: number) => {
            const error = new Error("failed", { cause })
            Object.defineProperty(error, Symbol.toStringTag, {
                value: "Object",
            })
            return error
        }
        expect(
            deepEqual(promiseWithObjectTag(1), promiseWithObjectTag(2)),
        ).toBe(false)
        expect(deepEqual(errorWithObjectTag(1), errorWithObjectTag(2))).toBe(
            false,
        )

        const error = new Error("failed", { cause: { code: 1 } })
        expect(deepEqual(error, error)).toBe(true)
        expect(
            deepEqual(
                new Error("failed", { cause: { code: 1 } }),
                new Error("failed", { cause: { code: 1 } }),
            ),
        ).toBe(false)
        expect(
            deepEqual(
                new AggregateError([1], "failed"),
                new AggregateError([1], "failed"),
            ),
        ).toBe(false)

        class DomLikeNode {
            readonly nodeType = 3
            readonly nodeName = "#text"
            readonly ownerDocument = {}
            cloneNode(): DomLikeNode {
                return new DomLikeNode()
            }
        }
        const node = new DomLikeNode()
        expect(deepEqual(node, node)).toBe(true)
        expect(deepEqual(node, new DomLikeNode())).toBe(false)
    })

    test("runs reached getters and value hooks, ignores hidden getters, and preserves thrown errors", () => {
        let leftReads = 0
        let rightReads = 0
        const left = {
            get value(): { nested: number } {
                leftReads++
                return { nested: 1 }
            },
        }
        const right = {
            get value(): { nested: number } {
                rightReads++
                return { nested: 1 }
            },
        }
        expect(deepEqual(left, right)).toBe(true)
        expect([leftReads, rightReads]).toEqual([1, 1])

        const hiddenLeft = {}
        const hiddenRight = {}
        Object.defineProperty(hiddenLeft, "hidden", {
            get(): never {
                throw new Error("hidden getter must not run")
            },
        })
        Object.defineProperty(hiddenRight, "hidden", {
            get(): never {
                throw new Error("hidden getter must not run")
            },
        })
        expect(deepEqual(hiddenLeft, hiddenRight)).toBe(true)

        let valueOfCalls = 0
        class PrivateCounter {
            readonly #value: number
            constructor(value: number) {
                this.#value = value
            }
            valueOf(): number {
                valueOfCalls++
                return this.#value
            }
        }
        expect(deepEqual(new PrivateCounter(1), new PrivateCounter(1))).toBe(
            true,
        )
        expect(deepEqual(new PrivateCounter(1), new PrivateCounter(2))).toBe(
            false,
        )
        expect(valueOfCalls).toBe(4)

        const getterError = new Error("getter failed")
        const throwingGetter = {
            get value(): never {
                throw getterError
            },
        }
        expect(thrownBy(() => deepEqual(throwingGetter, { value: 1 }))).toBe(
            getterError,
        )

        const hookError = new Error("valueOf failed")
        class ThrowingValue {
            valueOf(): never {
                throw hookError
            }
        }
        expect(
            thrownBy(() => deepEqual(new ThrowingValue(), new ThrowingValue())),
        ).toBe(hookError)

        const leftDefault = {}
        const rightCustom = {}
        Object.defineProperty(rightCustom, "toString", {
            value: () => "custom",
        })
        expect(deepEqual(leftDefault, rightCustom)).toBe(false)
        expect(deepEqual(rightCustom, leftDefault)).toBe(false)

        class MixedValueOf {
            readonly #value: unknown
            constructor(value: unknown) {
                this.#value = value
            }
            valueOf(): unknown {
                return this.#value
            }
        }
        expect(
            deepEqual(new MixedValueOf(1), new MixedValueOf({ value: 1 })),
        ).toBe(false)
        expect(
            deepEqual(new MixedValueOf({ value: 1 }), new MixedValueOf(1)),
        ).toBe(false)

        const proxyError = new Error("ownKeys failed")
        const hostileProxy = new Proxy(
            { value: 1 },
            {
                ownKeys(): never {
                    throw proxyError
                },
            },
        )
        expect(thrownBy(() => deepEqual(hostileProxy, { value: 1 }))).toBe(
            proxyError,
        )
    })

    test("rejects distinct circular structures while retaining identity and React owner carve-outs", () => {
        type CyclicObject = {
            readonly value: number
            self?: CyclicObject
        }
        const left: CyclicObject = { value: 1 }
        const right: CyclicObject = { value: 1 }
        left.self = left
        right.self = right

        expect(deepEqual(left, left)).toBe(true)
        expect(deepEqual(left, right)).toBe(false)
        expect(deepEqual(left, { value: 1, self: { value: 1 } })).toBe(false)

        const leftArray: unknown[] = []
        const rightArray: unknown[] = []
        leftArray.push(leftArray)
        rightArray.push(rightArray)
        expect(deepEqual(leftArray, rightArray)).toBe(false)

        const elementType = Symbol.for("react.element")
        const leftElement: {
            readonly $$typeof: symbol
            _owner?: unknown
            __v?: unknown
            __o?: unknown
            value?: number
        } = { $$typeof: elementType, value: 1 }
        const rightElement: typeof leftElement = {
            $$typeof: elementType,
            value: 1,
        }
        leftElement._owner = leftElement
        rightElement._owner = rightElement
        leftElement.__v = leftElement
        rightElement.__v = rightElement
        leftElement.__o = leftElement
        rightElement.__o = rightElement
        expect(deepEqual(leftElement, rightElement)).toBe(true)
        rightElement.value = 2
        expect(deepEqual(leftElement, rightElement)).toBe(false)
    })

    test("canonicalizes equal Atom writes to the retained value reference", () => {
        const initial = { id: 1, nested: { value: "same" } }
        const document = atom(initial, { equal: deepEqual })
        const target = store()
        let notifications = 0
        const unsubscribe = target.sub(document, () => notifications++)

        const equalReplacement = { id: 1, nested: { value: "same" } }
        target.set(document, equalReplacement)
        expect(target.get(document)).toBe(initial)
        expect(target.get(document)).not.toBe(equalReplacement)
        expect(notifications).toBe(0)

        const changed = { id: 1, nested: { value: "changed" } }
        target.set(document, changed)
        expect(target.get(document)).toBe(changed)
        expect(notifications).toBe(1)

        target.update(document, current => ({
            id: current.id,
            nested: { value: current.nested.value },
        }))
        expect(target.get(document)).toBe(changed)
        expect(notifications).toBe(1)
        unsubscribe()
    })

    test("retains equal Selector references and prunes downstream evaluation and notification", () => {
        const source = atom(1)
        let projectionEvaluations = 0
        let parentEvaluations = 0
        const projection = selector(
            get => {
                projectionEvaluations++
                return { parity: get(source) & 1 }
            },
            { equal: deepEqual },
        )
        const parent = selector(get => {
            parentEvaluations++
            return get(projection).parity
        })
        const target = store()
        let projectionNotifications = 0
        let parentNotifications = 0
        const unsubscribeProjection = target.sub(
            projection,
            () => projectionNotifications++,
        )
        const unsubscribeParent = target.sub(
            parent,
            () => parentNotifications++,
        )

        const firstProjection = target.get(projection)
        expect([projectionEvaluations, parentEvaluations]).toEqual([1, 1])

        target.set(source, 3)
        expect(target.get(projection)).toBe(firstProjection)
        expect([projectionEvaluations, parentEvaluations]).toEqual([2, 1])
        expect([projectionNotifications, parentNotifications]).toEqual([0, 0])

        target.set(source, 2)
        const changedProjection = target.get(projection)
        expect(changedProjection).not.toBe(firstProjection)
        expect(changedProjection).toEqual({ parity: 0 })
        expect([projectionEvaluations, parentEvaluations]).toEqual([3, 2])
        expect([projectionNotifications, parentNotifications]).toEqual([1, 1])

        unsubscribeParent()
        unsubscribeProjection()
    })
})
