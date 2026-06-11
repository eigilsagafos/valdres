import { describe, test, expect, spyOn } from "bun:test"
import { z } from "zod"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { selectorFamily } from "../selectorFamily"
import { store } from "../store"
import { wait } from "../../test/utils/wait"
import { SchemaValidationError } from "../errors/SchemaValidationError"
import type { StandardSchemaV1 } from "../types/StandardSchemaV1"

// A minimal Standard Schema (https://standard-schema.dev) with NO `parse`
// method — stands in for Valibot/ArkType to exercise the `~standard` path.
const standardString: StandardSchemaV1<string> = {
    "~standard": {
        version: 1,
        vendor: "test",
        validate: value =>
            typeof value === "string"
                ? { value }
                : { issues: [{ message: "expected string" }] },
        types: undefined,
    },
}

/**
 * Run `fn`, then collect everything reported to `console.error` while its async
 * work settles. Async validation failures can't be thrown to the caller, so
 * they're reported via console.error (matching valdres's other dev-time
 * diagnostics); this lets a test assert that a SchemaValidationError surfaced.
 */
const captureConsoleErrors = async (fn: () => void): Promise<unknown[]> => {
    const spy = spyOn(console, "error").mockImplementation(() => {})
    try {
        fn()
        await wait(20)
        return spy.mock.calls.map(call => call[0])
    } finally {
        spy.mockRestore()
    }
}

// Schema validation is opt-in per store: pass `{ schemaValidation: true }` to
// enable it. Most tests below create such a store; the "schemaValidation store
// option" block covers the default-off behavior and inheritance.
describe("schema validation", () => {
    describe("atom", () => {
        test("valid default value passes", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("invalid default value throws", () => {
            const store1 = store({ schemaValidation: true })
            // @ts-expect-error - intentionally passing wrong type
            const nameAtom = atom(123, { schema: z.string() })
            expect(() => store1.get(nameAtom)).toThrow()
        })

        test("valid set passes", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            store1.set(nameAtom, "world")
            expect(store1.get(nameAtom)).toBe("world")
        })

        test("invalid set throws", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow()
        })

        test("valid set with updater function passes", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            store1.set(nameAtom, prev => prev + " world")
            expect(store1.get(nameAtom)).toBe("hello world")
        })

        test("invalid set with updater function throws", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally returning wrong type
            expect(() => store1.set(nameAtom, () => 123)).toThrow()
        })

        test("complex schema validation", () => {
            const store1 = store({ schemaValidation: true })
            const userSchema = z.object({
                name: z.string(),
                age: z.number().min(0),
            })
            const userAtom = atom(
                { name: "Alice", age: 30 },
                { schema: userSchema },
            )
            expect(store1.get(userAtom)).toEqual({ name: "Alice", age: 30 })

            store1.set(userAtom, { name: "Bob", age: 25 })
            expect(store1.get(userAtom)).toEqual({ name: "Bob", age: 25 })

            expect(() =>
                // @ts-expect-error - intentionally passing wrong type
                store1.set(userAtom, { name: "Charlie" }),
            ).toThrow()
        })

        test("async default value is validated on resolve", async () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom(() => Promise.resolve("hello"), {
                schema: z.string(),
            })
            // Triggers init, value starts as a promise
            store1.get(nameAtom)
            await wait(10)
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("function default value is validated", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom(() => "hello", { schema: z.string() })
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("invalid function default value throws", () => {
            const store1 = store({ schemaValidation: true })
            // @ts-expect-error - intentionally returning wrong type
            const nameAtom = atom(() => 123, { schema: z.string() })
            expect(() => store1.get(nameAtom)).toThrow()
        })

        test("selector default value is validated against atom schema", () => {
            const store1 = store({ schemaValidation: true })
            const source = selector(get => "hello")
            const nameAtom = atom(source, { schema: z.string() })
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("invalid selector default value throws against atom schema", () => {
            const store1 = store({ schemaValidation: true })
            const source = selector(get => 123)
            // @ts-expect-error - selector returns number but atom schema expects string
            const nameAtom = atom(source, { schema: z.string() })
            expect(() => store1.get(nameAtom)).toThrow()
        })
    })

    describe("selector", () => {
        test("valid selector value passes", () => {
            const store1 = store({ schemaValidation: true })
            const numAtom = atom(5)
            const doubleSelector = selector(get => get(numAtom) * 2, {
                schema: z.number(),
            })
            expect(store1.get(doubleSelector)).toBe(10)
        })

        test("invalid selector value throws", () => {
            const store1 = store({ schemaValidation: true })
            const numAtom = atom(5)
            const badSelector = selector(
                // @ts-expect-error - intentionally returning wrong type
                get => String(get(numAtom)),
                { schema: z.number() },
            )
            expect(() => store1.get(badSelector)).toThrow()
        })

        test("schema validates on re-evaluation", () => {
            const store1 = store({ schemaValidation: true })
            const numAtom = atom<number | string>(5)
            const doubleSelector = selector(
                get => {
                    const val = get(numAtom)
                    if (typeof val === "number") return val * 2
                    return val // returns string — should fail validation
                },
                { schema: z.number() },
            )
            expect(store1.get(doubleSelector)).toBe(10)

            // This should cause the selector to return a string, failing validation
            expect(() => {
                store1.set(numAtom, "not a number")
                store1.get(doubleSelector)
            }).toThrow()
        })
    })

    describe("atomFamily", () => {
        test("schema is accessible on the family object and its members", () => {
            const schema = z.string()
            const fam = atomFamily<string, [string]>("default", {
                schema,
                schemaValidation: true,
            })
            // Family object itself exposes the schema (e.g. so a sync engine
            // can validate an incoming (family, key, value) payload without
            // materializing the member first).
            expect(fam.schema).toBe(schema)
            expect(fam.schemaValidation).toBe(true)
            // Members share the same reference
            expect(fam("k").schema).toBe(schema)
        })

        test("schema is applied to family members", () => {
            const store1 = store({ schemaValidation: true })
            const nameFamily = atomFamily<string, [string]>("default", {
                schema: z.string(),
            })
            const nameAtom = nameFamily("key1")
            expect(store1.get(nameAtom)).toBe("default")

            store1.set(nameAtom, "updated")
            expect(store1.get(nameAtom)).toBe("updated")

            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow()
        })
    })

    describe("selectorFamily", () => {
        test("schema is accessible on the family object", () => {
            const schema = z.number()
            const fam = selectorFamily<number, [number]>(
                () => () => 1,
                { schema, schemaValidation: true },
            )
            expect(fam.schema).toBe(schema)
            expect(fam.schemaValidation).toBe(true)
            expect(fam(1).schema).toBe(schema)
        })

        test("schema is applied to family members", () => {
            const store1 = store({ schemaValidation: true })
            const numAtom = atom(5)
            const multiplyFamily = selectorFamily<number, [number]>(
                (factor: number) => get => get(numAtom) * factor,
                { schema: z.number() },
            )
            expect(store1.get(multiplyFamily(2))).toBe(10)
            expect(store1.get(multiplyFamily(3))).toBe(15)
        })
    })

    describe("atom without schema", () => {
        test("no validation when schema is not provided", () => {
            const store1 = store({ schemaValidation: true })
            const anyAtom = atom<any>("hello")
            store1.set(anyAtom, 123)
            store1.set(anyAtom, { foo: "bar" })
            expect(store1.get(anyAtom)).toEqual({ foo: "bar" })
        })
    })

    describe("schemaValidation store option", () => {
        test("validation is skipped by default (opt-in)", () => {
            const store1 = store()
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            store1.set(nameAtom, 123)
            expect(store1.get(nameAtom)).toBe(123)
        })

        test("validation is skipped when schemaValidation is false", () => {
            const store1 = store({ schemaValidation: false })
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            store1.set(nameAtom, 123)
            expect(store1.get(nameAtom)).toBe(123)
        })

        test("validation runs when schemaValidation is true", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow()
        })

        test("selector validation is skipped by default", () => {
            const store1 = store()
            const numAtom = atom(5)
            const badSelector = selector(
                // @ts-expect-error - intentionally returning wrong type
                get => String(get(numAtom)),
                { schema: z.number() },
            )
            expect(store1.get(badSelector)).toBe("5")
        })

        test("scoped store inherits schemaValidation: true from parent", () => {
            const parent = store({ schemaValidation: true })
            const child = parent.scope("child")
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => child.set(nameAtom, 123)).toThrow()
        })

        test("scoped store stays off by default", () => {
            const parent = store()
            const child = parent.scope("child")
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            child.set(nameAtom, 123)
            expect(child.get(nameAtom)).toBe(123)
        })
    })

    // #4 — failures throw a SchemaValidationError that names the offending
    // atom/selector and carries the underlying error on `cause`.
    describe("error context", () => {
        test("throws SchemaValidationError naming the atom", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", {
                name: "userName",
                schema: z.string(),
            })
            try {
                // @ts-expect-error - intentionally passing wrong type
                store1.set(nameAtom, 123)
                throw new Error("expected throw")
            } catch (err) {
                expect(err).toBeInstanceOf(SchemaValidationError)
                expect((err as Error).message).toContain("userName")
                expect((err as SchemaValidationError).cause).toBeDefined()
            }
        })

        test("names the selector", () => {
            const store1 = store({ schemaValidation: true })
            const numAtom = atom(5)
            const badSelector = selector(
                // @ts-expect-error - intentionally returning wrong type
                get => String(get(numAtom)),
                { name: "stringified", schema: z.number() },
            )
            try {
                store1.get(badSelector)
                throw new Error("expected throw")
            } catch (err) {
                expect(err).toBeInstanceOf(SchemaValidationError)
                expect((err as Error).message).toContain("stringified")
            }
        })

        test("falls back gracefully when unnamed", () => {
            const store1 = store({ schemaValidation: true })
            // @ts-expect-error - intentionally wrong default
            const a = atom(5, { schema: z.string() })
            try {
                store1.get(a)
                throw new Error("expected throw")
            } catch (err) {
                expect(err).toBeInstanceOf(SchemaValidationError)
                expect((err as Error).message).toContain("anonymous")
            }
        })
    })

    // #3 — validate-only: schema.parse runs for its throwing side effect, but
    // the ORIGINAL value is stored. A transforming schema must not change the
    // stored value, so a store with validation on stores the same value as one
    // with it off (no dev/prod divergence).
    describe("validate-only (no transform)", () => {
        test("transform does not mutate the stored set value", () => {
            const store1 = store({ schemaValidation: true })
            const trimmed = atom("init", {
                schema: z.string().transform(s => s.trim()),
            })
            store1.set(trimmed, "  hello  ")
            expect(store1.get(trimmed)).toBe("  hello  ")
        })

        test("transform does not mutate the stored default value", () => {
            const store1 = store({ schemaValidation: true })
            const trimmed = atom("  hi  ", {
                schema: z.string().transform(s => s.trim()),
            })
            expect(store1.get(trimmed)).toBe("  hi  ")
        })

        test("stored value is identical whether validation is on or off", () => {
            const schema = z.string().transform(s => s.toUpperCase())
            const on = store({ schemaValidation: true })
            const off = store({ schemaValidation: false })
            const a = atom("init", { schema })
            on.set(a, "abc")
            off.set(a, "abc")
            expect(on.get(a)).toBe(off.get(a))
            expect(on.get(a)).toBe("abc")
        })

        test("invalid value still throws even though transform is ignored", () => {
            const store1 = store({ schemaValidation: true })
            const a = atom("init", {
                schema: z.string().transform(s => s.trim()),
            })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(a, 123)).toThrow(SchemaValidationError)
        })
    })

    // #1 — transactions validate at set()-time, so an invalid value throws
    // inside the txn body and the whole transaction is aborted (atomic).
    describe("transactions", () => {
        test("invalid txn set throws and aborts the whole transaction", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            const otherAtom = atom("a", { schema: z.string() })
            expect(() =>
                store1.txn(txn => {
                    txn.set(otherAtom, "b") // valid, staged first
                    // @ts-expect-error - intentionally passing wrong type
                    txn.set(nameAtom, 123) // invalid → throws here
                }),
            ).toThrow(SchemaValidationError)
            // Atomic: neither write committed
            expect(store1.get(nameAtom)).toBe("hello")
            expect(store1.get(otherAtom)).toBe("a")
        })

        test("valid txn set commits", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            store1.txn(txn => {
                txn.set(nameAtom, "world")
            })
            expect(store1.get(nameAtom)).toBe("world")
        })

        test("txn updater function is validated", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            expect(() =>
                store1.txn(txn => {
                    // @ts-expect-error - intentionally returning wrong type
                    txn.set(nameAtom, () => 123)
                }),
            ).toThrow(SchemaValidationError)
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("batched store set is validated (routes through a txn)", () => {
            const store1 = store({ batchUpdates: true, schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow(SchemaValidationError)
        })
    })

    // #2 — async validation failures never commit the invalid value and are
    // reported via console.error (consistent across set/default/selector),
    // rather than being silently swallowed or thrown as unhandled rejections.
    describe("async surfacing", () => {
        test("async atom set: invalid resolved value is reported and not committed", async () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            store1.get(nameAtom)
            const errors = await captureConsoleErrors(() => {
                // resolves to a number, which violates z.string()
                store1.set(nameAtom, Promise.resolve(123 as any))
            })
            expect(errors.some(e => e instanceof SchemaValidationError)).toBe(
                true,
            )
            // invalid value not committed — reverted to prior valid value
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("async atom default: invalid resolved value is reported", async () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom(() => Promise.resolve(123 as any), {
                schema: z.string(),
            })
            const errors = await captureConsoleErrors(() => {
                store1.get(nameAtom)
            })
            expect(errors.some(e => e instanceof SchemaValidationError)).toBe(
                true,
            )
            // The invalid value is dropped (not committed); a re-read would
            // re-init and re-fail, which is the intended retry semantics, so we
            // don't re-get here.
        })

        test("async selector: invalid resolved value is reported", async () => {
            const store1 = store({ schemaValidation: true })
            const src = atom(1)
            const badSelector = selector(
                get => Promise.resolve(String(get(src)) as any),
                { schema: z.number() },
            )
            const errors = await captureConsoleErrors(() => {
                store1.sub(badSelector, () => {})
                store1.get(badSelector)
            })
            expect(errors.some(e => e instanceof SchemaValidationError)).toBe(
                true,
            )
        })

        test("genuine async rejection is NOT reported as a schema error", async () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            store1.get(nameAtom)
            const errors = await captureConsoleErrors(() => {
                store1.set(
                    nameAtom,
                    Promise.reject(new Error("network")) as any,
                )
            })
            expect(errors.some(e => e instanceof SchemaValidationError)).toBe(
                false,
            )
        })
    })

    // #5 — per-atom override: an atom/selector can opt into (or out of)
    // validation independently of the store flag.
    describe("per-state schemaValidation override", () => {
        test("atom override validates even when the store flag is off", () => {
            const store1 = store() // off by default
            const nameAtom = atom("hello", {
                schema: z.string(),
                schemaValidation: true,
            })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow(SchemaValidationError)
        })

        test("atom override disables validation even when the store flag is on", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", {
                schema: z.string(),
                schemaValidation: false,
            })
            // @ts-expect-error - intentionally passing wrong type
            store1.set(nameAtom, 123)
            expect(store1.get(nameAtom)).toBe(123)
        })

        test("selector override validates even when the store flag is off", () => {
            const store1 = store()
            const numAtom = atom(5)
            const badSelector = selector(
                // @ts-expect-error - intentionally returning wrong type
                get => String(get(numAtom)),
                { schema: z.number(), schemaValidation: true },
            )
            expect(() => store1.get(badSelector)).toThrow(SchemaValidationError)
        })

        test("family member inherits per-atom override (store off)", () => {
            const store1 = store() // off by default
            const nameFamily = atomFamily<string, [string]>("default", {
                schema: z.string(),
                schemaValidation: true,
            })
            const member = nameFamily("k")
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(member, 123)).toThrow(SchemaValidationError)
        })
    })

    // Tripwire: every value-entry boundary must run validation. If a new write
    // path is added without routing through validateSchema/validateResolvedValue,
    // one of these should fail. (Sync set/default/selector + txn + batched are
    // covered above; these cover the boundaries the review found unguarded.)
    describe("boundary coverage", () => {
        test("M1: async selector default is validated against the atom schema", async () => {
            const store1 = store({ schemaValidation: true })
            const src = selector(() => Promise.resolve(123 as any))
            const fromSelector = atom<string>(src as any, {
                name: "fromSelector",
                schema: z.string(),
            })
            const errors = await captureConsoleErrors(() => {
                store1.get(fromSelector)
            })
            expect(errors.some(e => e instanceof SchemaValidationError)).toBe(
                true,
            )
        })

        test("S3: deleted family-member read is validated", () => {
            // Invalid default; the member is deleted before any read, so the
            // read goes through the deleted-member branch in getState.
            const fam = atomFamily<string, [number]>(() => 123 as any, {
                schema: z.string(),
                schemaValidation: true,
            })
            const store1 = store()
            store1.del(fam(1))
            expect(() => store1.get(fam(1))).toThrow(SchemaValidationError)
        })

        test("validation runs BEFORE the equality check — an equal-but-invalid set still throws", () => {
            // Pins a deliberate ordering decision in setAtom: validate-first
            // gives a deterministic "set(invalid) always throws" contract.
            // With an always-equal atom, equality-first would silently no-op
            // the invalid set; validate-first must throw.
            const store1 = store({ schemaValidation: true })
            const alwaysEqual = atom<any>("hello", {
                schema: z.string(),
                equal: () => true,
            })
            expect(store1.get(alwaysEqual)).toBe("hello")
            expect(() => store1.set(alwaysEqual, 123)).toThrow(
                SchemaValidationError,
            )
        })

        test("M5: error has name 'SchemaValidationError'", () => {
            const store1 = store({ schemaValidation: true })
            const a = atom("x", { name: "n", schema: z.string() })
            try {
                // @ts-expect-error - intentionally passing wrong type
                store1.set(a, 123)
                throw new Error("expected throw")
            } catch (err) {
                expect((err as Error).name).toBe("SchemaValidationError")
                expect(String(err)).toContain("SchemaValidationError")
            }
        })
    })

    // S6 — any Standard Schema works, not just Zod's classic `{ parse }`.
    describe("Standard Schema support", () => {
        test("validates via a parse-less Standard Schema (Valibot-style)", () => {
            const store1 = store({ schemaValidation: true })
            const a = atom("hello", { name: "std-valibot", schema: standardString })
            store1.set(a, "world")
            expect(store1.get(a)).toBe("world")
            // @ts-expect-error - wrong type
            expect(() => store1.set(a, 123)).toThrow(SchemaValidationError)
        })

        test("Standard Schema failure message includes the issue", () => {
            const store1 = store({ schemaValidation: true })
            const a = atom("hello", { name: "std-msg", schema: standardString })
            try {
                // @ts-expect-error - wrong type
                store1.set(a, 123)
                throw new Error("expected throw")
            } catch (err) {
                expect((err as Error).message).toContain("expected string")
                expect((err as Error).message).toContain("std-msg")
            }
        })

        test("rejects an asynchronous Standard Schema with a clear error", () => {
            const store1 = store({ schemaValidation: true })
            const asyncSchema: StandardSchemaV1<string> = {
                "~standard": {
                    version: 1,
                    vendor: "test",
                    validate: async value => ({ value: value as string }),
                    types: undefined,
                },
            }
            const a = atom("hello", { schema: asyncSchema })
            expect(() => store1.set(a, "world")).toThrow(
                /Asynchronous schema validation is not supported/,
            )
        })

        test("Zod async refinement surfaces (does not silently pass)", () => {
            const store1 = store({ schemaValidation: true })
            // An async refine forces Zod's sync parse() to throw — we surface it
            // rather than letting a valid-looking value through unchecked.
            const a = atom("hello", {
                schema: z.string().refine(async () => true),
            })
            expect(() => store1.set(a, "world")).toThrow(SchemaValidationError)
        })

        test("Zod still reports a ZodError on `cause` (parse path preferred)", () => {
            const store1 = store({ schemaValidation: true })
            const a = atom("hello", { name: "z", schema: z.string() })
            try {
                // @ts-expect-error - wrong type
                store1.set(a, 123)
                throw new Error("expected throw")
            } catch (err) {
                const cause = (err as SchemaValidationError).cause as any
                // Zod's error carries structured `issues`; a generic Error wouldn't.
                expect(cause?.issues ?? cause?.name).toBeDefined()
            }
        })
    })
})
