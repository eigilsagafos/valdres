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

    test("includes present atom and family values that are undefined", () => {
        const maybe = atom<number | undefined>(0, {
            name: "dh-undefined-atom",
        })
        const family = atomFamily<number | undefined, [string]>(0, {
            name: "dh-undefined-family",
        })
        const store1 = store()
        store1.set(maybe, undefined)
        store1.set(family("member"), undefined)

        expect(dehydrate(store1)).toEqual({
            atoms: [["dh-undefined-atom", undefined]],
            families: [["dh-undefined-family", ["member"], undefined]],
        })
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

    // Family args travel as raw JSON (the wire codec covers values only) and
    // hydrate re-derives the member with `family(...args)`. An arg that changes
    // across JSON.stringify/parse therefore mints a PHANTOM member on the
    // hydrating side — silently, and only in the SSR path. Dev-mode dehydrate
    // makes that a loud failure where the bug is.
    describe("non-JSON-safe family args (dev)", () => {
        test("a Date arg throws, naming the family and the arg path", () => {
            const fam = atomFamily<number, [Date]>(0, { name: "dh-json-date" })
            const store1 = store()
            store1.set(fam(new Date("2020-01-01T00:00:00.000Z")), 1)
            expect(() => dehydrate(store1)).toThrow("dh-json-date")
            expect(() => dehydrate(store1)).toThrow("args[0]")
            expect(() => dehydrate(store1)).toThrow("Date")
        })

        test("a BigInt arg throws (JSON.stringify would throw on the payload)", () => {
            const fam = atomFamily<number, [bigint]>(0, { name: "dh-json-big" })
            const store1 = store()
            store1.set(fam(7n), 1)
            expect(() => dehydrate(store1)).toThrow("dh-json-big")
            expect(() => dehydrate(store1)).toThrow("BigInt")
        })

        test("NaN and Infinity args throw (JSON writes null)", () => {
            const nan = atomFamily<number, [number]>(0, { name: "dh-json-nan" })
            const inf = atomFamily<number, [number]>(0, { name: "dh-json-inf" })
            const store1 = store()
            store1.set(nan(NaN), 1)
            expect(() => dehydrate(store1)).toThrow("NaN")
            const store2 = store()
            store2.set(inf(Infinity), 1)
            expect(() => dehydrate(store2)).toThrow("Infinity")
        })

        test("a -0 arg throws (JSON round-trips it to 0, a different key)", () => {
            const fam = atomFamily<number, [number]>(0, {
                name: "dh-json-negzero",
            })
            const store1 = store()
            store1.set(fam(-0), 1)
            expect(() => dehydrate(store1)).toThrow("-0")
        })

        test("Map and Set args throw (JSON writes {})", () => {
            const withMap = atomFamily<number, [Map<string, number>]>(0, {
                name: "dh-json-map",
            })
            const withSet = atomFamily<number, [Set<string>]>(0, {
                name: "dh-json-set",
            })
            const store1 = store()
            store1.set(withMap(new Map([["a", 1]])), 1)
            expect(() => dehydrate(store1)).toThrow("Map")
            const store2 = store()
            store2.set(withSet(new Set(["a"])), 1)
            expect(() => dehydrate(store2)).toThrow("Set")
        })

        test("an undefined arg throws (JSON drops or nulls it)", () => {
            const fam = atomFamily<number, [string]>(0, { name: "dh-json-undef" })
            const store1 = store()
            store1.set((fam as any)(undefined), 1)
            expect(() => dehydrate(store1)).toThrow("undefined")
        })

        test("the path points at the offending value inside a nested arg", () => {
            const fam = atomFamily<number, [string, { at: Date[] }]>(0, {
                name: "dh-json-nested",
            })
            const store1 = store()
            store1.set(fam("scope", { at: [new Date(0)] }), 1)
            expect(() => dehydrate(store1)).toThrow("args[1].at[0]")
        })

        test("the throw names the family even when another member is fine", () => {
            const fam = atomFamily<number, [any]>(0, { name: "dh-json-mixed" })
            const store1 = store()
            store1.set(fam("ok"), 1)
            store1.set(fam(new Date(0)), 2)
            expect(() => dehydrate(store1)).toThrow("dh-json-mixed")
        })

        test("a keyOf family is checked on its raw args, not its derived key", () => {
            class Entity {
                constructor(readonly id: string) {}
            }
            // keyOf makes the LOCAL key a string, but the payload still carries
            // the raw Entity — hydrate would re-run keyOf on a plain object.
            const fam = atomFamily<number, [Entity]>(0, {
                name: "dh-json-keyof",
                keyOf: entity => entity.id,
            })
            const store1 = store()
            store1.set(fam(new Entity("e1")), 1)
            expect(() => dehydrate(store1)).toThrow("dh-json-keyof")
            expect(() => dehydrate(store1)).toThrow("Entity")
        })

        // JSON.stringify writes an array's index elements and nothing else, so
        // an array arg needs the same own-key scrutiny as a plain object —
        // reachable via keyOf, which hands dehydrate the raw args.
        describe("array args are checked beyond their elements", () => {
            const rawArgFamily = (name: string) =>
                atomFamily<number, [any[]]>(0, {
                    name,
                    keyOf: (arg: any[]) => name + ":" + arg.length,
                })

            test("a toJSON hook throws (it rewrites the serialized value)", () => {
                const fam = rawArgFamily("dh-json-arr-tojson")
                const args: any = ["a"]
                args.toJSON = () => ["rewritten"]
                const store1 = store()
                store1.set(fam(args), 1)
                expect(() => dehydrate(store1)).toThrow("toJSON")
                // The hook really does change what crosses the wire.
                expect(JSON.parse(JSON.stringify(args))).toEqual(["rewritten"])
            })

            test("an expando property throws (JSON drops it)", () => {
                const fam = atomFamily<number, [any[]]>(0, {
                    name: "dh-json-arr-expando",
                    // A keyOf that reads the expando: after the round-trip the
                    // property is gone, so the member key would differ.
                    keyOf: (arg: any) => "k:" + arg.owner,
                })
                const args: any = ["a"]
                args.owner = "acme"
                const store1 = store()
                store1.set(fam(args), 1)
                expect(() => dehydrate(store1)).toThrow("args[0].owner")
                expect(JSON.parse(JSON.stringify(args)).owner).toBeUndefined()
            })

            test("a symbol-keyed property throws", () => {
                const fam = rawArgFamily("dh-json-arr-symbol")
                const args: any = ["a"]
                args[Symbol("owner")] = "acme"
                const store1 = store()
                store1.set(fam(args), 1)
                expect(() => dehydrate(store1)).toThrow("symbol-keyed")
            })

            test("an accessor element throws without invoking the getter", () => {
                const fam = rawArgFamily("dh-json-arr-getter")
                const args: any[] = []
                let getterCalls = 0
                Object.defineProperty(args, 0, {
                    configurable: true,
                    enumerable: true,
                    get: () => {
                        getterCalls++
                        return "a"
                    },
                })
                const store1 = store()
                store1.set(fam(args), 1)
                expect(() => dehydrate(store1)).toThrow("accessor property")
                expect(getterCalls).toBe(0)
            })

            test("a sparse hole throws (JSON writes null)", () => {
                const fam = rawArgFamily("dh-json-arr-hole")
                const store1 = store()
                // eslint-disable-next-line no-sparse-arrays
                store1.set(fam(["a", , "c"] as any), 1)
                expect(() => dehydrate(store1)).toThrow("args[0][1]")
                expect(() => dehydrate(store1)).toThrow("sparse-array hole")
            })

            test("an object arg with a toJSON hook throws", () => {
                const fam = atomFamily<number, [any]>(0, {
                    name: "dh-json-obj-tojson",
                    keyOf: (arg: any) => "k:" + arg.id,
                })
                const store1 = store()
                store1.set(fam({ id: "a", toJSON: () => ({ id: "b" }) }), 1)
                expect(() => dehydrate(store1)).toThrow("toJSON")
            })
        })

        // The guard runs BEFORE the pending-promise skip: a member's args are
        // broken whether or not its value happens to be settled right now, and
        // a timing-dependent error is the worst kind to ship. Deliberate — the
        // pending skip stays in force for members with transferable args.
        test("a pending member with unsafe args throws instead of being skipped", () => {
            const fam = atomFamily<number, [Date]>(undefined, {
                name: "dh-json-pending",
            })
            const store1 = store()
            store1.set(fam(new Date(0)), new Promise<number>(() => {}))
            const warn = spyOn(console, "warn").mockImplementation(mock())
            try {
                expect(() => dehydrate(store1)).toThrow("dh-json-pending")
                expect(warn).not.toHaveBeenCalled()
            } finally {
                warn.mockRestore()
            }
        })

        // The guard validates args' JSON DATA. Metadata JSON drops — descriptor
        // bits, extensibility, object identity — is out of scope BY DESIGN: a
        // keyOf reading it would diverge after hydration, but rejecting it here
        // would fire on ordinary code (see below), and wouldn't close the class
        // anyway (aliasing diverges identically and no descriptor check sees
        // it). The contract is narrowed on the atomFamily page instead: a named
        // family's keyOf must key off the args' JSON data.
        describe("value metadata is deliberately out of scope", () => {
            test("a frozen arg passes — valdres's own dev freeze produces them", () => {
                const fam = atomFamily<any, [any]>(undefined, {
                    name: "dh-json-frozen",
                })
                const entity = { id: "u1" }
                const store1 = store()
                // The everyday shape: the entity is both the key and the value,
                // and dev-mode deepFreeze freezes the value in place.
                store1.set(fam(entity), entity)
                expect(Object.isFrozen(entity)).toBe(true)
                expect(dehydrate(store1).families).toEqual([
                    ["dh-json-frozen", [{ id: "u1" }], { id: "u1" }],
                ])
            })

            test("aliased args pass (identity is not recoverable from JSON)", () => {
                const shared = { id: "s" }
                const fam = atomFamily<number, [any[]]>(0, {
                    name: "dh-json-alias",
                })
                const store1 = store()
                store1.set(fam([shared, shared]), 1)
                const payload = dehydrate(store1)
                expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
            })
        })

        test("string, number, boolean, null, array and plain-object args pass", () => {
            const fam = atomFamily<number, [any]>(0, { name: "dh-json-ok" })
            const store1 = store()
            store1.set(fam("u1"), 1)
            store1.set(fam(42), 2)
            store1.set(fam(true), 3)
            store1.set(fam(null), 4)
            store1.set(fam(["a", 1]), 5)
            store1.set(fam({ org: "acme", tags: ["x"], nested: { n: 1 } }), 6)
            const payload = dehydrate(store1)
            expect(payload.families).toHaveLength(6)
            // The whole point of the guard: this round-trip is lossless.
            expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
        })

        test("multiple JSON-safe args pass", () => {
            const fam = atomFamily<number, [string, number]>(0, {
                name: "dh-json-ok-multi",
            })
            const store1 = store()
            store1.set(fam("a", 1), 1)
            expect(dehydrate(store1).families).toEqual([
                ["dh-json-ok-multi", ["a", 1], 1],
            ])
        })
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
