import { describe, expect, test } from "bun:test"
import { runInNewContext } from "node:vm"
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
