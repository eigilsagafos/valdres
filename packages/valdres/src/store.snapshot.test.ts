import { describe, test, expect, spyOn } from "bun:test"
import { store } from "./store"
import { atom } from "./atom"
import { atomFamily } from "./atomFamily"
import { selector } from "./selector"
import { cacheMeta } from "./cacheMeta"
import type { SnapshotEntry } from "./types/SnapshotEntry"

describe("store.snapshot (enumerable mode)", () => {
    test("lists every set atom in the root with value, scope and type", () => {
        const s = store({ enumerable: true })
        const atom1 = atom(1)
        const atom2 = atom("a")
        s.set(atom1, 2)
        s.set(atom2, "b")

        const snap = s.snapshot()

        expect(snap).toContainEqual({
            type: "atom",
            state: atom1,
            value: 2,
            scope: [],
        })
        expect(snap).toContainEqual({
            type: "atom",
            state: atom2,
            value: "b",
            scope: [],
        })
    })

    test("a default-valued atom that was only read appears (materialized)", () => {
        const s = store({ enumerable: true })
        const atom1 = atom(42)
        // never set — only read
        expect(s.get(atom1)).toBe(42)

        const snap = s.snapshot()
        expect(snap).toContainEqual({
            type: "atom",
            state: atom1,
            value: 42,
            scope: [],
        })
    })

    test("a live named selector appears with type 'selector'", () => {
        const s = store({ enumerable: true })
        const atom1 = atom(2)
        const double = selector(get => get(atom1) * 2, { name: "double" })
        // make it live / evaluated
        s.sub(double, () => {})
        expect(s.get(double)).toBe(4)

        const snap = s.snapshot()
        expect(snap).toContainEqual({
            type: "selector",
            state: double,
            value: 4,
            scope: [],
        })
    })

    test("excludes __valdresInternal atoms and family containers", () => {
        const s = store({ enumerable: true })
        const atom1 = atom(1)
        const family = atomFamily((id: string) => id)
        const cm = cacheMeta(atom1)

        s.set(atom1, 5)
        // materialize a couple of family members + the family container
        s.set(family("x"), "X")
        s.set(family("y"), "Y")
        // touch the internal cacheMeta selector/atom
        s.get(cm)

        const snap = s.snapshot()

        // No entry whose state is __valdresInternal
        for (const entry of snap) {
            expect(
                (entry.state as { __valdresInternal?: boolean })
                    .__valdresInternal,
            ).toBeFalsy()
        }
        // Neither the family container nor the (live) cacheMeta selector is listed
        s.sub(cm, () => {}) // make the cacheMeta selector live so it caches a value
        const snapWithLiveCm = s.snapshot()
        const states = snapWithLiveCm.map(e => e.state)
        expect(states).not.toContain(family)
        expect(states).not.toContain(cm)
        // The real atom is still there
        expect(snap).toContainEqual({
            type: "atom",
            state: atom1,
            value: 5,
            scope: [],
        })
        // The family members are listed as atoms
        expect(snap).toContainEqual({
            type: "atom",
            state: family("x"),
            value: "X",
            scope: [],
        })
    })

    test("scope entries carry the scope id path", () => {
        const s = store({ enumerable: true })
        const atom1 = atom("root-default")
        const child = s.scope("child")
        child.set(atom1, "scoped")

        const snap = s.snapshot()
        expect(snap).toContainEqual({
            type: "atom",
            state: atom1,
            value: "scoped",
            scope: ["child"],
        })
    })

    test("nested scopes carry the full scope path", () => {
        const s = store({ enumerable: true })
        const atom1 = atom(0)
        const child = s.scope("child")
        const nested = child.scope("nested")
        nested.set(atom1, 99)

        const snap = s.snapshot()
        expect(snap).toContainEqual({
            type: "atom",
            state: atom1,
            value: 99,
            scope: ["child", "nested"],
        })
    })

    test("returns root and scope entries together", () => {
        const s = store({ enumerable: true })
        const rootAtom = atom("r")
        const scopeAtom = atom("s")
        s.set(rootAtom, "root-value")
        const child = s.scope("child")
        child.set(scopeAtom, "scope-value")

        const snap = s.snapshot()
        expect(snap).toContainEqual({
            type: "atom",
            state: rootAtom,
            value: "root-value",
            scope: [],
        })
        expect(snap).toContainEqual({
            type: "atom",
            state: scopeAtom,
            value: "scope-value",
            scope: ["child"],
        })
    })
})

describe("store.snapshot (default / non-enumerable mode)", () => {
    test("returns [] and warns once", () => {
        const warn = spyOn(console, "warn").mockImplementation(() => {})
        try {
            const s = store()
            const atom1 = atom(1)
            s.set(atom1, 2)

            expect(s.snapshot()).toEqual([])
            expect(s.snapshot()).toEqual([])
            expect(warn).toHaveBeenCalledTimes(1)
        } finally {
            warn.mockRestore()
        }
    })

    test("the returned value is typed as SnapshotEntry[]", () => {
        const s = store({ enumerable: true })
        const snap: SnapshotEntry[] = s.snapshot()
        expect(Array.isArray(snap)).toBe(true)
    })
})

describe("store() enumerable option dispatch", () => {
    const set = (s: ReturnType<typeof store>) => {
        const a = atom(1)
        s.set(a, 2)
        return a
    }

    test("store(id, { enumerable: true }) is enumerable", () => {
        const s = store("my-store", { enumerable: true })
        const a = set(s)
        expect(s.snapshot()).toContainEqual({
            type: "atom",
            state: a,
            value: 2,
            scope: [],
        })
    })

    test("store(undefined, { enumerable: true }) still honors the options", () => {
        // `id` may be an optional/undefined value at the call site; the second
        // arg must not be dropped.
        const s = store(undefined, { enumerable: true })
        const a = set(s)
        expect(s.snapshot()).toContainEqual({
            type: "atom",
            state: a,
            value: 2,
            scope: [],
        })
    })

    test("store({ enumerable: true }) is enumerable", () => {
        const s = store({ enumerable: true })
        const a = set(s)
        expect(s.snapshot()).toContainEqual({
            type: "atom",
            state: a,
            value: 2,
            scope: [],
        })
    })
})
