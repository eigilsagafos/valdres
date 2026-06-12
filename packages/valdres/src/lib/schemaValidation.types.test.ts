import { test } from "bun:test"
import { z } from "zod"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { selectorFamily } from "../selectorFamily"
import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Selector } from "../types/Selector"
import type { StandardSchemaV1 } from "../types/StandardSchemaV1"

// Type test utilities — a failing assertion produces a TS error at compile time
type Expect<T extends true> = T
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false

test("atom infers type from schema", () => {
    const stringAtom = atom(undefined, { schema: z.string() })
    type _1 = Expect<Equal<typeof stringAtom, Atom<string>>>

    const numberAtom = atom(42, { schema: z.number() })
    type _2 = Expect<Equal<typeof numberAtom, Atom<number>>>

    // Schema prevents setting wrong type
    // @ts-expect-error - number is not assignable to string schema
    atom("hello", { schema: z.number() })
})

test("atom infers complex type from schema", () => {
    const userSchema = z.object({ name: z.string(), age: z.number() })
    const userAtom = atom({ name: "Alice", age: 30 }, { schema: userSchema })
    type _1 = Expect<Equal<typeof userAtom, Atom<{ name: string; age: number }>>>
})

test("atom infers the RUNTIME (output) type from a codec schema", () => {
    // The atom stores the codec's output side; the wire side only exists in
    // DehydratedState payloads.
    const bigintCodec = z.codec(z.string(), z.bigint(), {
        decode: s => BigInt(s),
        encode: b => b.toString(),
    })
    const supplyAtom = atom(undefined, { schema: bigintCodec })
    type _1 = Expect<Equal<typeof supplyAtom, Atom<bigint>>>

    // @ts-expect-error - the wire type (string) is not the stored type
    atom("42", { schema: bigintCodec })
})

test("selector infers type from schema", () => {
    const numAtom = atom(5)
    const derived = selector(get => get(numAtom) * 2, {
        schema: z.number(),
    })
    type _1 = Expect<Equal<typeof derived, Selector<number>>>
})

test("atom without schema still infers from default value", () => {
    const plainAtom = atom("hello")
    type _1 = Expect<Equal<typeof plainAtom, Atom<string>>>
})

test("selector without schema still infers from get function", () => {
    const plainAtom = atom("hello")
    const plainSelector = selector(get => get(plainAtom).toUpperCase())
    type _1 = Expect<Equal<typeof plainSelector, Selector<string>>>
})

test("atomFamily with schema", () => {
    const family = atomFamily<string, [string]>("default", {
        schema: z.string(),
    })
    const familyAtom = family("key")
    type _1 = Expect<Equal<typeof familyAtom, AtomFamilyAtom<string, [string]>>>
})

test("selectorFamily with schema", () => {
    const numAtom = atom(5)
    const selFamily = selectorFamily<number, [number]>(
        (factor: number) => get => get(numAtom) * factor,
        { schema: z.number() },
    )
    const selFamilyMember = selFamily(2)
    type _1 = Expect<Equal<typeof selFamilyMember, Selector<number, [number]>>>
})

test("schemaValidation option is accepted and preserves inference", () => {
    // The per-atom/selector override is an accepted option and does not disturb
    // the type inferred from the schema/default.
    const a = atom("hello", { schema: z.string(), schemaValidation: true })
    type _1 = Expect<Equal<typeof a, Atom<string>>>

    const numAtom = atom(5)
    const s = selector(get => get(numAtom) * 2, {
        schema: z.number(),
        schemaValidation: false,
    })
    type _2 = Expect<Equal<typeof s, Selector<number>>>
})

test("infers from a Standard Schema (Valibot/ArkType-style, no parse)", () => {
    const standardNumber: StandardSchemaV1<number> = {
        "~standard": {
            version: 1,
            vendor: "test",
            validate: value =>
                typeof value === "number"
                    ? { value }
                    : { issues: [{ message: "expected number" }] },
            types: undefined,
        },
    }
    const a = atom(undefined, { schema: standardNumber })
    type _1 = Expect<Equal<typeof a, Atom<number>>>
})
