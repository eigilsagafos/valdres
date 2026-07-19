import { describe, expect, mock, spyOn, test } from "bun:test"
import { z } from "zod"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { SchemaValidationError } from "../errors/SchemaValidationError"
import { getStoreData } from "../lib/getStoreData"
import { getNamedStateIndex } from "../lib/namedStateIndex"
import { valdresGlobal } from "../lib/valdresGlobal"
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

    test("does not scan the global registry or family identity cache", () => {
        const fam = atomFamily<number, [string]>(0, {
            name: "dh-local-index-fam",
        })
        const unrelated = atomFamily<number, [number]>(0, {
            name: "dh-local-index-unrelated",
        })
        const store1 = store()
        store1.set(fam("owned"), 1)

        // Keep unrelated identities live. Their exact count is deliberately
        // small: iterator-call instrumentation below guards the asymptotic
        // behavior without a timing threshold or a slow test fixture.
        const unrelatedMembers = Array.from({ length: 32 }, (_, i) =>
            unrelated(i),
        )
        expect(unrelatedMembers).toHaveLength(32)

        const registry = valdresGlobal().registry
        const registryIterator = registry[Symbol.iterator]
        const familyValues = fam.__valdresAtomFamilyMap.values
        const unrelatedValues = unrelated.__valdresAtomFamilyMap.values
        let registryScans = 0
        let familyCacheScans = 0

        registry[Symbol.iterator] = function () {
            registryScans++
            return registryIterator.call(this)
        }
        fam.__valdresAtomFamilyMap.values = function () {
            familyCacheScans++
            return familyValues.call(this)
        }
        unrelated.__valdresAtomFamilyMap.values = function () {
            familyCacheScans++
            return unrelatedValues.call(this)
        }

        try {
            expect(dehydrate(store1).families).toEqual([
                ["dh-local-index-fam", ["owned"], 1],
            ])
            expect(registryScans).toBe(0)
            expect(familyCacheScans).toBe(0)
        } finally {
            // Each method was inherited; delete the temporary own override so
            // this test leaves the shared registry/cache objects unchanged.
            delete (registry as any)[Symbol.iterator]
            delete (fam.__valdresAtomFamilyMap as any).values
            delete (unrelated.__valdresAtomFamilyMap as any).values
        }
    })

    test("prunes named atoms from the local index when their value is removed", () => {
        const kept = atom(0, { name: "dh-local-index-kept" })
        const removed = atom(0, { name: "dh-local-index-removed" })
        const store1 = store()
        store1.set(kept, 1)
        store1.set(removed, 2)

        expect([...getNamedStateIndex(getStoreData(store1))!.values()]).toEqual(
            ["dh-local-index-kept", "dh-local-index-removed"],
        )

        store1.unset(removed)

        expect([...getNamedStateIndex(getStoreData(store1))!.values()]).toEqual(
            ["dh-local-index-kept"],
        )
        expect(dehydrate(store1).atoms).toEqual([["dh-local-index-kept", 1]])
    })

    test("index bookkeeping does not probe an unnamed atom's name property", () => {
        const unnamed = atom(0)
        let nameReads = 0
        Object.defineProperty(unnamed, "name", {
            configurable: true,
            get: () => {
                nameReads++
                return undefined
            },
        })
        const store1 = store()

        store1.get(unnamed)
        store1.unset(unnamed)

        // Registration, not a mutable optional property, is the source of
        // truth. Keeping this at zero also protects Bun/JSC's steady atom-read
        // property-access shape from initialization-only index bookkeeping.
        expect(nameReads).toBe(0)
    })

    test("prunes a named atom when stale re-initialization throws", () => {
        let now = 0
        let initializations = 0
        const nowSpy = spyOn(Date, "now").mockImplementation(() => now)
        try {
            const stale = atom(
                () => {
                    if (initializations++ === 0) return 1
                    throw new Error("stale init failed")
                },
                { name: "dh-stale-init-failure", maxAge: 0 },
            )
            const store1 = store()
            expect(store1.get(stale)).toBe(1)
            expect(getNamedStateIndex(getStoreData(store1))?.has(stale)).toBe(
                true,
            )

            now = 1
            expect(() => store1.get(stale)).toThrow("stale init failed")

            expect(getStoreData(store1).values.has(stale)).toBe(false)
            expect(
                getNamedStateIndex(getStoreData(store1))?.has(stale) ?? false,
            ).toBe(false)
        } finally {
            nowSpy.mockRestore()
        }
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
