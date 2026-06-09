import { describe, expect, test } from "bun:test"
import { stableStringify } from "./stableStringify"

describe("stableStringify", () => {
    test("string fast path passes through", () => {
        expect(stableStringify("hello")).toBe("hello")
    })

    test("primitives", () => {
        expect(stableStringify(42)).toBe(42)
        expect(stableStringify(true)).toBe(true)
        expect(stableStringify(null)).toBe("null")
    })

    test("array of strings is deterministic", () => {
        expect(stableStringify(["a", "b"])).toBe('["a","b"]')
    })

    test("object keys are sorted for stable output", () => {
        const a = stableStringify({ b: 1, a: 2 })
        const b = stableStringify({ a: 2, b: 1 })
        expect(a).toBe(b)
    })

    describe("circular references", () => {
        test("self-referencing object does not crash, returns a string", () => {
            const obj: any = { name: "root" }
            obj.self = obj
            // The exact representation can use a sentinel; what matters
            // is that it doesn't throw and returns a string that can be
            // used as a Map key.
            const result = stableStringify(obj)
            expect(typeof result).toBe("string")
            expect((result as string).length).toBeGreaterThan(0)
        })

        test("mutually-referencing objects do not crash", () => {
            const a: any = { name: "a" }
            const b: any = { name: "b", ref: a }
            a.ref = b
            expect(() => stableStringify(a)).not.toThrow()
            expect(() => stableStringify(b)).not.toThrow()
        })

        test("circular array does not crash", () => {
            const arr: any[] = [1, 2]
            arr.push(arr)
            expect(() => stableStringify(arr)).not.toThrow()
            expect(typeof stableStringify(arr)).toBe("string")
        })

        test("non-circular but deeply nested objects still work", () => {
            // Sanity check: the cycle guard must not break legitimate
            // deep structures.
            const obj = {
                a: { b: { c: { d: { e: "leaf" } } } },
            }
            expect(stableStringify(obj)).toBe(
                '{"a":{"b":{"c":{"d":{"e":"leaf"}}}}}',
            )
        })

        test("any cyclic graph collapses to the circular sentinel (acceptable collision)", () => {
            // The try/catch fallback in `stableStringify` returns a single
            // sentinel for any cycle — we lose the precision a `seen`-set
            // approach gives, but in exchange the happy path pays zero
            // overhead. Cyclic family args / index terms are an anti-pattern
            // anyway, so all cyclic input collapsing to one bucket is
            // acceptable.
            const a: any = { name: "alice" }
            a.self = a
            const b: any = { name: "bob" }
            b.self = b
            expect(stableStringify(a)).toBe(stableStringify(b))
            expect(stableStringify(a)).toBe("__CIRCULAR__")
        })

        test("S3: doesn't swallow user-thrown Error whose message contains 'stack'", () => {
            // Previously matched on /stack|recursion/i which silently
            // swallowed any user error containing those substrings.
            // After fix: only catch RangeError (Chrome/Safari/Edge) and
            // Firefox's InternalError; everything else propagates.
            const userError = new Error("stack frame parsing failed")
            const x = {
                toJSON() {
                    throw userError
                },
            }
            expect(() => stableStringify(x)).toThrow(userError)
        })

        test("S3: catches a RangeError with an opaque message", () => {
            // Defensive: even a RangeError whose message doesn't match
            // the legacy regex must still be caught via `instanceof`.
            const x = {
                toJSON() {
                    throw new RangeError("opaque engine message")
                },
            }
            expect(stableStringify(x)).toBe("__CIRCULAR__")
        })
    })
})
