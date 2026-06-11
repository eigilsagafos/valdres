import { describe, expect, mock, spyOn, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import type { DehydratedState } from "../types/DehydratedState"
import { store } from "../store"
import { dehydrate } from "./dehydrate"
import { hydrate } from "./hydrate"

describe("hydrate", () => {
    test("server→client round trip across two stores through JSON", () => {
        const count = atom(0, { name: "hy-rt-count" })
        const label = atom("untouched", { name: "hy-rt-label" })
        const user = atomFamily<{ id: string; n: number }, [string]>(
            undefined,
            { name: "hy-rt-user" },
        )
        const doc = atomFamily<string, [string, number]>(undefined, {
            name: "hy-rt-doc",
        })
        const byQuery = atomFamily<string[], [{ page: number; q: string }]>(
            undefined,
            { name: "hy-rt-byQuery" },
        )

        const server = store()
        server.set(count, 42)
        server.set(user("u1"), { id: "u1", n: 1 })
        server.set(doc("a", 2), "multi-arg member")
        server.set(byQuery({ page: 2, q: "x" }), ["hit1", "hit2"])

        // The payload survives the actual wire format.
        const payload: DehydratedState = JSON.parse(
            JSON.stringify(dehydrate(server)),
        )

        const client = store()
        hydrate(client, payload)

        expect(client.get(count)).toBe(42)
        expect(client.get(label)).toBe("untouched") // absent from payload
        expect(client.get(user("u1"))).toEqual({ id: "u1", n: 1 })
        // multi-arg and object-arg keys resolve to the SAME member after the
        // JSON round trip (family(...args) re-derives the internal cache key)
        expect(client.get(doc("a", 2))).toBe("multi-arg member")
        expect(client.get(byQuery({ page: 2, q: "x" }))).toEqual([
            "hit1",
            "hit2",
        ])
        // the hydrated members are listed in the client's family index
        expect(client.get(user)).toHaveLength(1)
    })

    test("applies everything in ONE transaction", () => {
        const a = atom(0, { name: "hy-txn-a" })
        const b = atom(0, { name: "hy-txn-b" })
        const server = store()
        server.set(a, 1)
        server.set(b, 2)
        const payload = dehydrate(server)

        const client = store()
        const onChange = mock(() => {})
        const unsub = client.onChange(onChange)
        hydrate(client, payload)
        unsub()
        // one committed operation: both atom writes in a single callback
        expect(onChange).toHaveBeenCalledTimes(1)
        const [changes, meta] = onChange.mock.calls[0] as unknown as [
            { state: unknown }[],
            { source: string },
        ]
        expect(meta.source).toBe("transaction")
        expect(changes.map(c => c.state)).toEqual([a, b])
    })

    test("a custom-equal atom round-trips, and hydrate respects its equality", () => {
        const idEqual = atom(
            { id: 0, rev: 0 },
            {
                name: "hy-eq-atom",
                equal: (a, b) => a.id === b.id,
            },
        )
        const server = store()
        server.set(idEqual, { id: 1, rev: 1 })
        const payload: DehydratedState = JSON.parse(
            JSON.stringify(dehydrate(server)),
        )

        const fresh = store()
        hydrate(fresh, payload)
        expect(fresh.get(idEqual)).toEqual({ id: 1, rev: 1 })

        // hydrate writes through txn.set, so the atom's custom equal applies
        // exactly as in any transaction: an `equal` incoming value is written
        // without notifying (no propagation, no subscriber fire).
        const warm = store()
        warm.set(idEqual, { id: 1, rev: 99 })
        const subscriber = mock(() => {})
        warm.sub(idEqual, subscriber)
        hydrate(warm, payload)
        expect(warm.get(idEqual)).toEqual({ id: 1, rev: 1 })
        expect(subscriber).toHaveBeenCalledTimes(0)
    })

    test("unknown names warn and are skipped; known entries still apply", () => {
        const known = atom(0, { name: "hy-unknown-known" })
        const payload: DehydratedState = {
            atoms: [
                ["hy-never-registered-atom", 123],
                ["hy-unknown-known", 7],
            ],
            families: [["hy-never-registered-family", ["k"], 1]],
        }
        const client = store()
        const warn = spyOn(console, "warn").mockImplementation(mock())
        try {
            hydrate(client, payload)
            expect(client.get(known)).toBe(7)
            expect(warn).toHaveBeenCalledTimes(2)
            expect(warn.mock.calls[0][0]).toContain(
                "hy-never-registered-atom",
            )
            expect(warn.mock.calls[1][0]).toContain(
                "hy-never-registered-family",
            )
        } finally {
            warn.mockRestore()
        }
    })

    test("entry-kind mismatches warn and are skipped", () => {
        atom(0, { name: "hy-mm-atom" })
        atomFamily<number, [string]>(0, { name: "hy-mm-family" })
        const payload: DehydratedState = {
            // atom entry pointing at a family, family entry pointing at an atom
            atoms: [["hy-mm-family", 1]],
            families: [["hy-mm-atom", ["k"], 1]],
        }
        const client = store()
        const warn = spyOn(console, "warn").mockImplementation(mock())
        try {
            expect(() => hydrate(client, payload)).not.toThrow()
            expect(warn).toHaveBeenCalledTimes(2)
            expect(warn.mock.calls[0][0]).toContain("registered as an atomFamily")
            expect(warn.mock.calls[1][0]).toContain("registered as an atom")
        } finally {
            warn.mockRestore()
        }
    })
})
