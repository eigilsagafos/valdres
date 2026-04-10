import { describe, test, expect } from "bun:test"
import { z } from "zod"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { selectorFamily } from "../selectorFamily"
import { store } from "../store"
import { wait } from "../../test/utils/wait"

describe("schema validation", () => {
    describe("atom", () => {
        test("valid default value passes", () => {
            const store1 = store()
            const nameAtom = atom("hello", { schema: z.string() })
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("invalid default value throws", () => {
            const store1 = store()
            // @ts-expect-error - intentionally passing wrong type
            const nameAtom = atom(123, { schema: z.string() })
            expect(() => store1.get(nameAtom)).toThrow()
        })

        test("valid set passes", () => {
            const store1 = store()
            const nameAtom = atom("hello", { schema: z.string() })
            store1.set(nameAtom, "world")
            expect(store1.get(nameAtom)).toBe("world")
        })

        test("invalid set throws", () => {
            const store1 = store()
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow()
        })

        test("valid set with updater function passes", () => {
            const store1 = store()
            const nameAtom = atom("hello", { schema: z.string() })
            store1.set(nameAtom, prev => prev + " world")
            expect(store1.get(nameAtom)).toBe("hello world")
        })

        test("invalid set with updater function throws", () => {
            const store1 = store()
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally returning wrong type
            expect(() => store1.set(nameAtom, () => 123)).toThrow()
        })

        test("complex schema validation", () => {
            const store1 = store()
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
            const store1 = store()
            const nameAtom = atom(() => Promise.resolve("hello"), {
                schema: z.string(),
            })
            // Triggers init, value starts as a promise
            store1.get(nameAtom)
            await wait(10)
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("function default value is validated", () => {
            const store1 = store()
            const nameAtom = atom(() => "hello", { schema: z.string() })
            expect(store1.get(nameAtom)).toBe("hello")
        })

        test("invalid function default value throws", () => {
            const store1 = store()
            // @ts-expect-error - intentionally returning wrong type
            const nameAtom = atom(() => 123, { schema: z.string() })
            expect(() => store1.get(nameAtom)).toThrow()
        })
    })

    describe("selector", () => {
        test("valid selector value passes", () => {
            const store1 = store()
            const numAtom = atom(5)
            const doubleSelector = selector(get => get(numAtom) * 2, {
                schema: z.number(),
            })
            expect(store1.get(doubleSelector)).toBe(10)
        })

        test("invalid selector value throws", () => {
            const store1 = store()
            const numAtom = atom(5)
            const badSelector = selector(
                // @ts-expect-error - intentionally returning wrong type
                get => String(get(numAtom)),
                { schema: z.number() },
            )
            expect(() => store1.get(badSelector)).toThrow()
        })

        test("schema validates on re-evaluation", () => {
            const store1 = store()
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
        test("schema is applied to family members", () => {
            const store1 = store()
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
        test("schema is applied to family members", () => {
            const store1 = store()
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
            const store1 = store()
            const anyAtom = atom<any>("hello")
            store1.set(anyAtom, 123)
            store1.set(anyAtom, { foo: "bar" })
            expect(store1.get(anyAtom)).toEqual({ foo: "bar" })
        })
    })

    describe("schemaValidation store option", () => {
        test("validation is skipped when schemaValidation is false", () => {
            const store1 = store({ schemaValidation: false })
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            store1.set(nameAtom, 123)
            expect(store1.get(nameAtom)).toBe(123)
        })

        test("validation runs by default", () => {
            const store1 = store()
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow()
        })

        test("validation runs when schemaValidation is true", () => {
            const store1 = store({ schemaValidation: true })
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            expect(() => store1.set(nameAtom, 123)).toThrow()
        })

        test("selector validation is skipped when schemaValidation is false", () => {
            const store1 = store({ schemaValidation: false })
            const numAtom = atom(5)
            const badSelector = selector(
                // @ts-expect-error - intentionally returning wrong type
                get => String(get(numAtom)),
                { schema: z.number() },
            )
            expect(store1.get(badSelector)).toBe("5")
        })

        test("scoped store inherits schemaValidation: false from parent", () => {
            const parent = store({ schemaValidation: false })
            const child = parent.scope("child")
            const nameAtom = atom("hello", { schema: z.string() })
            // @ts-expect-error - intentionally passing wrong type
            child.set(nameAtom, 123)
            expect(child.get(nameAtom)).toBe(123)
        })
    })
})
