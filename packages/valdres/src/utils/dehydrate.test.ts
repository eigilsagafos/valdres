import { describe, expect, mock, spyOn, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { dehydrate } from "./dehydrate"

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

    test("scoped stores throw (root stores only in v1)", () => {
        const root = store()
        const scoped = root.scope("dh-scope")
        expect(() => dehydrate(scoped)).toThrow("only supports root stores")
        scoped.detach()
    })
})
