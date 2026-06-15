import { describe, expect, mock, spyOn, test } from "bun:test"
import { z } from "zod"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { SchemaValidationError } from "../errors/SchemaValidationError"
import { selector } from "../selector"
import { store } from "../store"
import { dehydrate } from "./dehydrate"

const bigintCodec = z.codec(z.string(), z.bigint(), {
    decode: s => BigInt(s),
    encode: b => b.toString(),
})

describe("dehydrate", () => {
    test("payload shape: [name, value] atoms and [name, args, value] family entries", () => {
        const count = atom(0, { name: "dh-shape-count" })
        const user = atomFamily<{ id: string }, [string]>(undefined, {
            name: "dh-shape-user",
        })
        const store1 = store()
        store1.set(count, 7)
        store1.set(user("u1"), { id: "u1" })
        expect(dehydrate(store1)).toEqual({
            atoms: [["dh-shape-count", 7]],
            families: [["dh-shape-user", ["u1"], { id: "u1" }]],
        })
    })

    test("includes only state with an own value in THIS store", () => {
        const a = atom(1, { name: "dh-own-a" })
        const b = atom(2, { name: "dh-own-b" })
        const store1 = store()
        const store2 = store()
        store1.set(a, 10)
        store2.set(b, 20)
        expect(dehydrate(store1).atoms).toEqual([["dh-own-a", 10]])
        expect(dehydrate(store2).atoms).toEqual([["dh-own-b", 20]])
    })

    test("a read-initialized atom (default materialized) is included", () => {
        const a = atom("default-value", { name: "dh-read-a" })
        const store1 = store()
        store1.get(a)
        expect(dehydrate(store1).atoms).toEqual([
            ["dh-read-a", "default-value"],
        ])
    })

    test("family members are filtered per store even though the member cache is module-global", () => {
        const fam = atomFamily<number, [string]>(0, { name: "dh-req-fam" })
        const request1 = store()
        const request2 = store()
        request1.set(fam("r1-only"), 1)
        request2.set(fam("r2-only"), 2)
        expect(dehydrate(request1).families).toEqual([
            ["dh-req-fam", ["r1-only"], 1],
        ])
        expect(dehydrate(request2).families).toEqual([
            ["dh-req-fam", ["r2-only"], 2],
        ])
    })

    test("unnamed atoms and named selectors are never included", () => {
        const unnamed = atom(1)
        const named = atom(2, { name: "dh-excl-named" })
        const sel = selector(get => get(named) * 2, { name: "dh-excl-sel" })
        const store1 = store()
        store1.set(unnamed, 11)
        store1.set(named, 22)
        store1.get(sel) // materialize the selector's cached value
        expect(dehydrate(store1)).toEqual({
            atoms: [["dh-excl-named", 22]],
            families: [],
        })
    })

    test("promise-pending values are skipped with a dev warning", () => {
        const pending = atom<number>(() => new Promise<number>(() => {}), {
            name: "dh-pending",
        })
        const settled = atom(1, { name: "dh-settled" })
        const store1 = store()
        store1.get(pending)
        store1.set(settled, 5)
        const warn = spyOn(console, "warn").mockImplementation(mock())
        try {
            expect(dehydrate(store1)).toEqual({
                atoms: [["dh-settled", 5]],
                families: [],
            })
            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn.mock.calls[0][0]).toContain("dh-pending")
            expect(warn.mock.calls[0][0]).toContain("pending promise")
        } finally {
            warn.mockRestore()
        }
    })

    test("a pending family member is skipped, settled siblings survive", () => {
        const fam = atomFamily<number, [string]>(undefined, {
            name: "dh-pend-fam",
        })
        const store1 = store()
        store1.set(fam("ok"), 1)
        store1.set(fam("pending"), new Promise<number>(() => {}))
        const warn = spyOn(console, "warn").mockImplementation(mock())
        try {
            expect(dehydrate(store1).families).toEqual([
                ["dh-pend-fam", ["ok"], 1],
            ])
            expect(warn).toHaveBeenCalledTimes(1)
        } finally {
            warn.mockRestore()
        }
    })

    test("a zero-arg member (untyped JS call) is skipped with a dev warning", () => {
        const fam = atomFamily<number, [string]>(0, { name: "dh-zeroargs" })
        const store1 = store()
        store1.set(fam("ok"), 1)
        // Only possible from untyped JS — the Args tuple forbids it in TS.
        store1.set((fam as any)(), 2)
        const warn = spyOn(console, "warn").mockImplementation(mock())
        try {
            expect(dehydrate(store1).families).toEqual([
                ["dh-zeroargs", ["ok"], 1],
            ])
            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn.mock.calls[0][0]).toContain("zero args")
        } finally {
            warn.mockRestore()
        }
    })

    test("scoped stores throw (root stores only in v1)", () => {
        const root = store()
        const scoped = root.scope("dh-scope")
        expect(() => dehydrate(scoped)).toThrow("only supports root stores")
        scoped.detach()
    })

    // Atoms with a bidirectional schema (zod 4) are wire-encoded: the encode
    // direction produces the JSON-safe value and the entry is marked with a
    // trailing 1 so hydrate knows to decode it.
    describe("schema wire-encoding", () => {
        test("a codec atom encodes to its wire type, and the payload survives JSON", () => {
            const budget = atom(0n, { name: "dhc-bigint", schema: bigintCodec })
            const store1 = store()
            store1.set(budget, 123456789123456789n)
            const payload = dehydrate(store1)
            expect(payload.atoms).toEqual([
                ["dhc-bigint", "123456789123456789", 1],
            ])
            // raw BigInt would make JSON.stringify throw — encoded it's a string
            expect(() => JSON.stringify(payload)).not.toThrow()
        })

        test("a plain zod schema encodes as a validating identity (still marked)", () => {
            const title = atom("", { name: "dhc-plain", schema: z.string() })
            const store1 = store()
            store1.set(title, "hello")
            expect(dehydrate(store1).atoms).toEqual([["dhc-plain", "hello", 1]])
        })

        test("codecs nested in object schemas encode through", () => {
            const stats = atom(
                { count: 0n, label: "" },
                {
                    name: "dhc-nested",
                    schema: z.object({ count: bigintCodec, label: z.string() }),
                },
            )
            const store1 = store()
            store1.set(stats, { count: 7n, label: "a" })
            expect(dehydrate(store1).atoms).toEqual([
                ["dhc-nested", { count: "7", label: "a" }, 1],
            ])
        })

        test("family members encode via the family's schema", () => {
            const balances = atomFamily<bigint, [string]>(undefined, {
                name: "dhc-fam",
                schema: bigintCodec,
            })
            const store1 = store()
            store1.set(balances("acct1"), 42n)
            expect(dehydrate(store1).families).toEqual([
                ["dhc-fam", ["acct1"], "42", 1],
            ])
        })

        test("a one-way transform schema falls back to the raw value with a dev warning", () => {
            const trimmed = atom("", {
                name: "dhc-transform",
                schema: z.string().transform(s => s.trim()),
            })
            const store1 = store()
            store1.set(trimmed, "  raw  ")
            const warn = spyOn(console, "warn").mockImplementation(mock())
            try {
                expect(dehydrate(store1).atoms).toEqual([
                    ["dhc-transform", "  raw  "],
                ])
                expect(warn).toHaveBeenCalledTimes(1)
                expect(warn.mock.calls[0][0]).toContain("dhc-transform")
                // warned once per schema, not once per dehydrate
                dehydrate(store1)
                expect(warn).toHaveBeenCalledTimes(1)
            } finally {
                warn.mockRestore()
            }
        })

        test("classic parse-only and Standard-Schema-only validators stay raw", () => {
            const classic = atom(0, {
                name: "dhc-classic",
                schema: {
                    parse: (v: unknown) => {
                        if (typeof v !== "number") throw new Error("nope")
                        return v
                    },
                },
            })
            const store1 = store()
            store1.set(classic, 5)
            expect(dehydrate(store1).atoms).toEqual([["dhc-classic", 5]])
        })

        test("a stored value that fails its own schema's encode throws, naming the atom", () => {
            const strict = atom<bigint>(undefined, {
                name: "dhc-invalid",
                schema: bigintCodec,
            })
            const store1 = store() // validation off: the bad write lands
            store1.set(strict, "not-a-bigint" as unknown as bigint)
            expect(() => dehydrate(store1)).toThrow(SchemaValidationError)
            expect(() => dehydrate(store1)).toThrow("dhc-invalid")
        })
    })
})
