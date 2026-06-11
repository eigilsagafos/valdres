import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
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
        atom(1, { global: true, name: "reg-dup-global" })
        expect(() => atom(2, { global: true, name: "reg-dup-global" })).toThrow(
            "'reg-dup-global' already exists",
        )
    })

    test("global atomFamily re-creation is idempotent, registered once", () => {
        const f1 = atomFamily<number, [string]>(0, {
            global: true,
            name: "reg-global-family",
        })
        const f2 = atomFamily<number, [string]>(0, {
            global: true,
            name: "reg-global-family",
        })
        expect(Object.is(f1, f2)).toBe(true)
        expect(valdresGlobal().registry.get("reg-global-family")).toBe(f1)
    })
})
