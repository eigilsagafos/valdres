import { describe, test, expect, spyOn } from "bun:test"
import { store } from "./store"
import { atom } from "./atom"
import { atomFamily } from "./atomFamily"
import { selector } from "./selector"
import { cacheMeta } from "./cacheMeta"
import type { InternalState } from "./types/InternalState"
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

    test("a selector whose value is undefined appears too", () => {
        // A materialized selector was invisible here whenever its value was
        // `undefined`: `initSelector` skipped the write because the computed
        // value compared equal to the absent-entry sentinel, so nothing landed
        // in `values` for `collect()` to iterate. This module's own doc comment
        // claimed "a selector only appears when it holds a cached value — which,
        // iterating `values`, it always does", which was false for exactly this
        // case. Asserted here rather than only through the internal
        // `values.has` invariant because it is public behavior that
        // `@valdres/redux-devtools` and any snapshot consumer sees.
        const s = store({ enumerable: true })
        const source = atom(1)
        const absent = selector<number | undefined>(
            get => (get(source) === 1 ? undefined : get(source)),
            { name: "snapshot-undefined" },
        )
        s.sub(absent, () => {})
        expect(s.get(absent)).toBeUndefined()

        const snap = s.snapshot()
        expect(snap).toContainEqual({
            type: "selector",
            state: absent,
            value: undefined,
            scope: [],
        })

        // And it stays listed with the right value across a transition in both
        // directions, so the entry tracks the selector rather than lingering.
        s.set(source, 5)
        expect(s.snapshot()).toContainEqual({
            type: "selector",
            state: absent,
            value: 5,
            scope: [],
        })
        s.set(source, 1)
        expect(s.snapshot()).toContainEqual({
            type: "selector",
            state: absent,
            value: undefined,
            scope: [],
        })
    })

    test("an undefined-valued selector appears when read without a subscriber", () => {
        // The transitive, unsubscribed shape: no `getDefault` restore fallback
        // and no live graph, so this is the case that stayed broken longest.
        const s = store({ enumerable: true })
        const source = atom(1)
        const child = selector<undefined>(
            get => {
                get(source)
                return undefined
            },
            { name: "snapshot-undefined-cold" },
        )
        const parent = selector(get => get(child) === undefined, {
            name: "snapshot-undefined-parent",
        })
        expect(s.get(parent)).toBe(true)

        expect(s.snapshot()).toContainEqual({
            type: "selector",
            state: child,
            value: undefined,
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
            expect((entry.state as InternalState).__valdresInternal).toBeFalsy()
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
