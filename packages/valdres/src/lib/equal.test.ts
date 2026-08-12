import { describe, expect, mock, test } from "bun:test"
import { runInNewContext } from "node:vm"
import { atom } from "../atom"
import { store } from "../store"
import { equal } from "./equal"

describe("equal binary values", () => {
    test("compares ArrayBuffer contents", () => {
        const left = new Uint8Array([0, 1, 2, 255]).buffer
        const same = new Uint8Array([0, 1, 2, 255]).buffer
        const different = new Uint8Array([0, 1, 3, 255]).buffer

        expect(equal(left, same)).toBe(true)
        expect(equal(left, different)).toBe(false)
        expect(equal(left, new ArrayBuffer(3))).toBe(false)

        const largeLeft = new Uint8Array(67).fill(7)
        const largeSame = new Uint8Array(largeLeft)
        const differentWord = new Uint8Array(largeLeft)
        const differentTail = new Uint8Array(largeLeft)
        differentWord[32] = 8
        differentTail[66] = 8

        expect(equal(largeLeft.buffer, largeSame.buffer)).toBe(true)
        expect(equal(largeLeft.buffer, differentWord.buffer)).toBe(false)
        expect(equal(largeLeft.buffer, differentTail.buffer)).toBe(false)
    })

    test("compares SharedArrayBuffer contents when available", () => {
        if (typeof SharedArrayBuffer === "undefined") return

        const left = new SharedArrayBuffer(3)
        const same = new SharedArrayBuffer(3)
        const different = new SharedArrayBuffer(3)
        new Uint8Array(left).set([1, 2, 3])
        new Uint8Array(same).set([1, 2, 3])
        new Uint8Array(different).set([1, 2, 4])

        expect(equal(left, same)).toBe(true)
        expect(equal(left, different)).toBe(false)
    })

    test("compares ArrayBuffers created in another realm", () => {
        const [left, same, different] = runInNewContext(`
            const buffers = [
                new Uint8Array([1, 2, 3]).buffer,
                new Uint8Array([1, 2, 3]).buffer,
                new Uint8Array([1, 2, 4]).buffer,
            ]
            buffers
        `)

        expect(equal(left, same)).toBe(true)
        expect(equal(left, different)).toBe(false)
    })

    test("compares matching binary brands across realms", () => {
        const foreign = runInNewContext(`({
            buffer: new Uint8Array([1, 2, 3]).buffer,
            view: new DataView(new Uint8Array([9, 1, 2, 9]).buffer, 1, 2),
            typed: new Uint16Array([1, 2, 3]),
        })`)

        expect(equal(new Uint8Array([1, 2, 3]).buffer, foreign.buffer)).toBe(
            true,
        )
        expect(
            equal(
                new DataView(new Uint8Array([8, 1, 2, 8]).buffer, 1, 2),
                foreign.view,
            ),
        ).toBe(true)
        expect(equal(new Uint16Array([1, 2, 3]), foreign.typed)).toBe(true)
    })

    test("compares only the visible bytes of DataView values", () => {
        const left = new Uint8Array([9, 1, 2, 9]).buffer
        const same = new Uint8Array([8, 1, 2, 8]).buffer
        const different = new Uint8Array([8, 1, 3, 8]).buffer

        expect(equal(new DataView(left, 1, 2), new DataView(same, 1, 2))).toBe(
            true,
        )
        expect(
            equal(new DataView(left, 1, 2), new DataView(different, 1, 2)),
        ).toBe(false)
        expect(equal(new DataView(left, 1, 2), new DataView(same, 1, 1))).toBe(
            false,
        )
    })

    test("uses byte semantics for floating-point typed arrays", () => {
        const positiveZero = new Float32Array([0])
        const negativeZero = new Float32Array([-0])
        const firstNaN = new Float32Array(new Uint32Array([0x7fc00000]).buffer)
        const sameNaN = new Float32Array(new Uint32Array([0x7fc00000]).buffer)
        const otherNaN = new Float32Array(new Uint32Array([0x7fc00001]).buffer)

        expect(equal(positiveZero, negativeZero)).toBe(false)
        expect(equal(firstNaN, sameNaN)).toBe(true)
        expect(equal(firstNaN, otherNaN)).toBe(false)
    })

    test("uses byte semantics for Float16Array when available", () => {
        const Float16Array = (globalThis as any).Float16Array
        if (typeof Float16Array !== "function") return

        const firstNaN = new Float16Array(new Uint16Array([0x7e00]).buffer)
        const sameNaN = new Float16Array(new Uint16Array([0x7e00]).buffer)
        const otherNaN = new Float16Array(new Uint16Array([0x7e01]).buffer)

        expect(equal(firstNaN, sameNaN)).toBe(true)
        expect(equal(firstNaN, otherNaN)).toBe(false)
    })
})

// A value the equality check cannot see is a value `set` silently drops: the
// write bails as a no-op, the store keeps the old object, and nothing warns.
describe("writes that only equal() can drop", () => {
    test("commits a set that differs only in a symbol-keyed prop", () => {
        const tag = Symbol("tag")
        const config = atom({ id: 1, [tag]: "a" })
        const testStore = store()
        const onChange = mock(() => {})
        testStore.sub(config, onChange)

        testStore.set(config, { id: 1, [tag]: "b" })

        expect(testStore.get(config)[tag]).toBe("b")
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    test("commits a set that differs only in an array expando", () => {
        const first = [1, 2, 3] as number[] & { cursor?: string }
        first.cursor = "a"
        const second = [1, 2, 3] as number[] & { cursor?: string }
        second.cursor = "b"
        const page = atom(first)
        const testStore = store()
        const onChange = mock(() => {})
        testStore.sub(page, onChange)

        testStore.set(page, second)

        expect(testStore.get(page).cursor).toBe("b")
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    test("commits a set on a sparse array differing only in an expando", () => {
        const withCursor = (cursor: string) =>
            Object.assign([1, , 3] as (number | undefined)[], { cursor })
        const page = atom(withCursor("a"))
        const testStore = store()
        const onChange = mock(() => {})
        testStore.sub(page, onChange)

        testStore.set(page, withCursor("b"))

        expect(testStore.get(page).cursor).toBe("b")
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    test("commits a set on a Map differing only in an attached prop", () => {
        const tagged = (tag: string) =>
            Object.assign(new Map([[1, 2]]), { tag })
        const index = atom(tagged("a"), { mutable: true })
        const testStore = store()
        const onChange = mock(() => {})
        testStore.sub(index, onChange)

        testStore.set(index, tagged("b"))

        expect(testStore.get(index).tag).toBe("b")
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    test("commits a set that differs only in a custom valueOf's siblings", () => {
        class Money {
            constructor(
                public amount: number,
                public currency: string,
            ) {}
            valueOf() {
                return this.amount
            }
        }
        const price = atom(new Money(5, "USD"))
        const testStore = store()
        const onChange = mock(() => {})
        testStore.sub(price, onChange)

        testStore.set(price, new Money(5, "EUR"))

        expect(testStore.get(price).currency).toBe("EUR")
        expect(onChange).toHaveBeenCalledTimes(1)
    })
})

describe("equal own enumerable properties", () => {
    test("compares symbol-keyed props on objects", () => {
        const tag = Symbol("tag")
        const other = Symbol("other")

        expect(equal({ id: 1, [tag]: 1 }, { id: 1, [tag]: 1 })).toBe(true)
        expect(equal({ id: 1, [tag]: 1 }, { id: 1, [tag]: 2 })).toBe(false)
        expect(equal({ id: 1, [tag]: 1 }, { id: 1 })).toBe(false)
        expect(equal({ id: 1 }, { id: 1, [tag]: 1 })).toBe(false)
        expect(equal({ [tag]: 1 }, { [other]: 1 })).toBe(false)
        // Distinct symbols are distinct keys even with the same description.
        expect(equal({ [Symbol("x")]: 1 }, { [Symbol("x")]: 1 })).toBe(false)
        // Values behind a symbol key compare deeply, like string-keyed ones.
        expect(equal({ [tag]: { n: 1 } }, { [tag]: { n: 1 } })).toBe(true)
        expect(equal({ [tag]: { n: 1 } }, { [tag]: { n: 2 } })).toBe(false)
    })

    test("ignores non-enumerable symbol props, as it does string ones", () => {
        const tag = Symbol("tag")
        const withHidden = {}
        Object.defineProperty(withHidden, tag, { value: 1 })
        const withOtherHidden = {}
        Object.defineProperty(withOtherHidden, tag, { value: 2 })

        expect(equal(withHidden, withOtherHidden)).toBe(true)
        expect(equal(withHidden, {})).toBe(true)
    })

    test("compares expando props on arrays", () => {
        const withCursor = (cursor: string) =>
            Object.assign([1, 2, 3], { cursor })

        expect(equal(withCursor("a"), withCursor("a"))).toBe(true)
        expect(equal(withCursor("a"), withCursor("b"))).toBe(false)
        expect(equal(withCursor("a"), [1, 2, 3])).toBe(false)
        expect(equal([1, 2, 3], withCursor("a"))).toBe(false)
        expect(equal(withCursor("a"), [1, 2, 4])).toBe(false)
    })

    test("compares symbol-keyed props on arrays", () => {
        const tag = Symbol("tag")
        const tagged = (value: number) =>
            Object.assign([1, 2], { [tag]: value })

        expect(equal(tagged(1), tagged(1))).toBe(true)
        expect(equal(tagged(1), tagged(2))).toBe(false)
        expect(equal(tagged(1), [1, 2])).toBe(false)
    })

    test("keeps plain and sparse array semantics", () => {
        expect(equal([1, 2, 3], [1, 2, 3])).toBe(true)
        expect(equal([1, 2, 3], [1, 2, 4])).toBe(false)
        expect(equal([1, 2], [1, 2, 3])).toBe(false)
        expect(equal([], [])).toBe(true)
        expect(equal([{ a: 1 }], [{ a: 1 }])).toBe(true)

        const sparse = [1, , 3]
        const sameSparse = [1, , 3]
        expect(equal(sparse, sameSparse)).toBe(true)
        expect(equal(sparse, [1, , 4])).toBe(false)
        expect(equal(Object.assign([1, , 3], { x: 1 }), sparse)).toBe(false)
    })

    test("sees extras on a sparse array, whose hole offsets the key count", () => {
        // A hole and an expando cancel out in a count of own keys: both sides
        // here report 4, exactly like a dense 3-element array.
        const withCursor = (cursor: string) =>
            Object.assign([1, , 3], { cursor })
        expect(Reflect.ownKeys(withCursor("a")).length).toBe(4)

        expect(equal(withCursor("a"), withCursor("a"))).toBe(true)
        expect(equal(withCursor("a"), withCursor("b"))).toBe(false)

        const tag = Symbol("tag")
        const tagged = (value: number) =>
            Object.assign([1, , 3], { [tag]: value })
        expect(equal(tagged(1), tagged(1))).toBe(true)
        expect(equal(tagged(1), tagged(2))).toBe(false)

        // Two holes and two expandos cancel just as exactly.
        const twoHoles = (x: string, y: string) =>
            Object.assign([1, , , 4], { x, y })
        expect(equal(twoHoles("a", "b"), twoHoles("a", "b"))).toBe(true)
        expect(equal(twoHoles("a", "b"), twoHoles("a", "c"))).toBe(false)
    })

    test("compares props attached beside Map, Set and RegExp contents", () => {
        const taggedMap = (tag: string) =>
            Object.assign(new Map([[1, 2]]), { tag })
        expect(equal(taggedMap("a"), taggedMap("a"))).toBe(true)
        expect(equal(taggedMap("a"), taggedMap("b"))).toBe(false)
        expect(equal(taggedMap("a"), new Map([[1, 2]]))).toBe(false)

        const taggedSet = (tag: string) => Object.assign(new Set([1]), { tag })
        expect(equal(taggedSet("a"), taggedSet("a"))).toBe(true)
        expect(equal(taggedSet("a"), taggedSet("b"))).toBe(false)

        const sym = Symbol("tag")
        const symMap = (value: number) =>
            Object.assign(new Map([[1, 2]]), { [sym]: value })
        expect(equal(symMap(1), symMap(2))).toBe(false)

        const taggedRe = (tag: string) => Object.assign(/x/g, { tag })
        expect(equal(taggedRe("a"), taggedRe("a"))).toBe(true)
        expect(equal(taggedRe("a"), taggedRe("b"))).toBe(false)
        // Plain values are unaffected: lastIndex is non-enumerable.
        expect(equal(/x/g, /x/g)).toBe(true)
        expect(equal(/x/g, /y/g)).toBe(false)
        expect(equal(new Map([[1, 2]]), new Map([[1, 2]]))).toBe(true)
        expect(equal(new Set([1]), new Set([1]))).toBe(true)
    })

    test("compares binary values by bytes alone", () => {
        // Documented carve-out: enumerating a typed array's keys is O(n) —
        // 42µs for 1000 elements — so props beside the bytes are not compared.
        const tagged = (tag: string) =>
            Object.assign(new Uint8Array([1, 2]), { tag })
        expect(equal(tagged("a"), tagged("b"))).toBe(true)
        expect(equal(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(
            false,
        )
    })

    test("does not let a custom valueOf or toString stand in for state", () => {
        class Money {
            constructor(
                public amount: number,
                public currency: string,
            ) {}
            valueOf() {
                return this.amount
            }
        }
        expect(equal(new Money(5, "USD"), new Money(5, "USD"))).toBe(true)
        expect(equal(new Money(5, "USD"), new Money(5, "EUR"))).toBe(false)
        expect(equal(new Money(5, "USD"), new Money(6, "USD"))).toBe(false)

        class Label {
            constructor(
                public text: string,
                public color: string,
            ) {}
            toString() {
                return this.text
            }
        }
        expect(equal(new Label("hi", "red"), new Label("hi", "red"))).toBe(true)
        expect(equal(new Label("hi", "red"), new Label("hi", "blue"))).toBe(
            false,
        )
        expect(equal(new Label("hi", "red"), new Label("yo", "red"))).toBe(
            false,
        )

        // State held outside own enumerable props is still only visible
        // through valueOf, so that comparison has to stay decisive.
        class Counter {
            #count: number
            constructor(count: number) {
                this.#count = count
            }
            valueOf() {
                return this.#count
            }
        }
        expect(equal(new Counter(1), new Counter(1))).toBe(true)
        expect(equal(new Counter(1), new Counter(2))).toBe(false)
    })

    test("keeps Date and boxed-primitive semantics", () => {
        expect(equal(new Date(1000), new Date(1000))).toBe(true)
        expect(equal(new Date(1000), new Date(2000))).toBe(false)
        // Two invalid dates are the same value, not two different NaNs.
        expect(equal(new Date(NaN), new Date(NaN))).toBe(true)
        expect(
            equal(new Date(1000), Object.assign(new Date(1000), { x: 1 })),
        ).toBe(false)
        expect(equal(new Number(5), new Number(5))).toBe(true)
        expect(equal(new Number(5), new Number(6))).toBe(false)
        expect(equal(new String("a"), new String("a"))).toBe(true)
        expect(equal(new String("a"), new String("b"))).toBe(false)
    })
})
