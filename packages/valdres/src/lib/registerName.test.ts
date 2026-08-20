import { describe, expect, spyOn, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { globalAtom } from "../globalAtom"
import { globalAtomFamily } from "../globalAtomFamily"
import { selector } from "../selector"
import { valdresGlobal } from "./valdresGlobal"

describe("named state registry", () => {
    test("a named atom registers in the global registry", () => {
        const a = atom(1, { name: "reg-basic-atom" })
        expect(valdresGlobal().registry.get("reg-basic-atom")).toBe(a)
    })

    test("a named atomFamily registers the FAMILY, not its members", () => {
        const family = atomFamily<number, [string]>(0, { name: "reg-family" })
        const member = family("k1")
        expect(valdresGlobal().registry.get("reg-family")).toBe(family)
        // member atoms carry a derived name but never register individually
        expect(member.name).toBe("reg-family_k1")
        expect(valdresGlobal().registry.has("reg-family_k1")).toBe(false)
    })

    test("unnamed atoms and families do not register", () => {
        const before = valdresGlobal().registry.size
        atom(1)
        atom(1, { mutable: true })
        atomFamily<number, [string]>(0)
        expect(valdresGlobal().registry.size).toBe(before)
    })

    test("named selectors do not register", () => {
        atom(1, { name: "reg-sel-atom" })
        selector(get => 1, { name: "reg-sel-atom-suffix" })
        expect(valdresGlobal().registry.has("reg-sel-atom-suffix")).toBe(false)
        // ...and a selector may even reuse an atom's name without throwing
        expect(() => selector(get => 2, { name: "reg-sel-atom" })).not.toThrow()
    })

    test("duplicate atom name throws", () => {
        atom(1, { name: "reg-dup-atom" })
        expect(() => atom(2, { name: "reg-dup-atom" })).toThrow(
            "'reg-dup-atom' already exists",
        )
    })

    test("duplicate name across kinds throws (atom vs atomFamily)", () => {
        atom(1, { name: "reg-dup-cross" })
        expect(() =>
            atomFamily<number, [string]>(0, { name: "reg-dup-cross" }),
        ).toThrow("'reg-dup-cross' already exists")
    })

    test("duplicate global atom name throws", () => {
        globalAtom(1, { name: "reg-dup-global" })
        expect(() => globalAtom(2, { name: "reg-dup-global" })).toThrow(
            "'reg-dup-global' already exists",
        )
    })

    test("global atomFamily re-evaluation warns and keeps the first definition", () => {
        const warn = spyOn(console, "warn").mockImplementation(() => {})
        try {
            const f1 = globalAtomFamily<string, [string]>(
                key => `first:${key}`,
                {
                    name: "reg-global-family",
                    mutable: false,
                },
            )
            const f2 = globalAtomFamily<string, [string]>(
                key => `second:${key}`,
                {
                    name: "reg-global-family",
                    mutable: true,
                },
            )

            expect(f2).toBe(f1)
            expect(f2("member").getSelf()).toBe("first:member")
            expect(f2("member").mutable).toBe(false)
            expect(valdresGlobal().registry.get("reg-global-family")).toBe(f1)
            expect(warn).toHaveBeenCalledWith(
                expect.stringMatching(
                    /global atomFamily 'reg-global-family'.*first definition.*defaultValue and options.*ignored/i,
                ),
            )
        } finally {
            warn.mockRestore()
        }
    })

    test("global atomFamily rejects an atom registered under its name", () => {
        globalAtom(1, { name: "reg-global-kind-mismatch" })
        expect(() =>
            globalAtomFamily<number, [string]>(0, {
                name: "reg-global-kind-mismatch",
            }),
        ).toThrow(/kind mismatch.*registered as an atom.*atomFamily/i)
    })

    test("global atomFamily rejects a detectable keyOf arity mismatch", () => {
        globalAtomFamily<string, [string, number]>(
            (key, revision) => `${key}:${revision}`,
            {
                name: "reg-global-keyof-contract",
                keyOf: key => key,
            },
        )

        expect(() =>
            globalAtomFamily<string, [string, number]>(
                (key, revision) => `${key}:${revision}:later`,
                {
                    name: "reg-global-keyof-contract",
                    keyOf: (key, revision) => `${key}:${revision}`,
                },
            ),
        ).toThrow(/contract mismatch.*keyOf.*arity.*1.*2/i)
    })

    test("global atomFamily does not infer arity through default or rest parameters", () => {
        const warn = spyOn(console, "warn").mockImplementation(() => {})
        try {
            const first = globalAtomFamily<string, [string, number]>(
                (key, revision) => `${key}:${revision}`,
                {
                    name: "reg-global-keyof-default-parameter",
                    keyOf: (key, revision = 0) => `${key}:${revision}`,
                },
            )

            expect(() =>
                globalAtomFamily<string, [string, number]>(
                    (key, revision) => `${key}:${revision}:later`,
                    {
                        name: "reg-global-keyof-default-parameter",
                        keyOf: (key, revision) => `${key}:${revision}`,
                    },
                ),
            ).not.toThrow()
            expect(
                globalAtomFamily<string, [string, number]>("ignored", {
                    name: "reg-global-keyof-default-parameter",
                    keyOf: (key, revision = 0) => `${key}:${revision}`,
                }),
            ).toBe(first)

            const restFamily = globalAtomFamily<string, [string, ...number[]]>(
                (key, ...revisions) => `${key}:${revisions.join(":")}`,
                {
                    name: "reg-global-keyof-rest-parameter",
                    keyOf: (key, ...revisions) =>
                        `${key}:${revisions.join(":")}`,
                },
            )
            expect(() =>
                globalAtomFamily<string, [string, ...number[]]>("ignored", {
                    name: "reg-global-keyof-rest-parameter",
                    keyOf: (key, revision) => `${key}:${revision}`,
                }),
            ).not.toThrow()
            expect(
                globalAtomFamily<string, [string, ...number[]]>("ignored", {
                    name: "reg-global-keyof-rest-parameter",
                    keyOf: (key, ...revisions) =>
                        `${key}:${revisions.join(":")}`,
                }),
            ).toBe(restFamily)
        } finally {
            warn.mockRestore()
        }
    })
})
