/** Trace oracle · single-store transactions.
 *
 *  A transaction is ONE commit: every staged write applies before any subscriber
 *  runs, one onChange carries all changes, one commitEnd fires. A throwing
 *  callback cancels the whole txn atomically (no partial commit). Writes made by
 *  subscribers during the commit coalesce into the outer commit's single
 *  commitEnd. */
import { expect } from "bun:test"
import { store } from "../../src/store"
import type { Atom } from "../../src/types/Atom"
import type { Store } from "../../src/types/Store"
import { runTraceTable, type TraceCase } from "./runTable"
import {
    type ChangeCall,
    type Recorder,
    traceChange,
    traceCommitEnd,
    tracedAtom,
    traceSub,
} from "./traceRecorder"

type Ctx = {
    store: Store
    changes: ChangeCall[]
    states: Record<string, Atom<any>>
}

const cases: TraceCase<Ctx>[] = [
    {
        name: "multi-atom txn — one onChange carrying both changes, one commitEnd",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 0)
            const b = tracedAtom(rec, "b", 0)
            traceSub(rec, s, a, "a")
            traceSub(rec, s, b, "b")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a, b } }
        },
        act: ({ store: s, states }) =>
            s.txn(({ set }) => {
                set(states.a, 1)
                set(states.b, 2)
            }),
        trace: [
            "onSet:a",
            "onSet:b",
            ["sub:a", "sub:b"],
            "onChange",
            "commitEnd",
        ],
        assert: ({ store: s, states, changes }) => {
            expect(s.get(states.a)).toBe(1)
            expect(s.get(states.b)).toBe(2)
            // ONE onChange call, carrying BOTH atom changes.
            expect(changes).toHaveLength(1)
            expect(changes[0]!.changes).toHaveLength(2)
            expect(changes[0]!.meta.source).toBe("transaction")
        },
    },
    {
        name: "no-op txn (all writes equal) — does not commit at all",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 1)
            const b = tracedAtom(rec, "b", 2)
            s.get(a)
            s.get(b)
            traceSub(rec, s, a, "a")
            traceSub(rec, s, b, "b")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a, b } }
        },
        act: ({ store: s, states }) =>
            s.txn(({ set }) => {
                set(states.a, 1) // unchanged
                set(states.b, 2) // unchanged
            }),
        // Symmetry worth pinning: a `txn` whose every write is value-equal is
        // no more a commit than a no-op direct `set`. Its boundary has to be
        // opened before the write phase can tell, but it closes without
        // announcing anything — no onSet, no subscriber, no onChange, no
        // commitEnd.
        trace: [],
        assert: ({ changes }) => expect(changes).toHaveLength(0),
    },
    {
        name: "throwing txn — whole txn cancelled, no partial commit, error surfaces",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 0)
            const b = tracedAtom(rec, "b", 0)
            traceSub(rec, s, a, "a")
            traceSub(rec, s, b, "b")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a, b } }
        },
        act: ({ store: s, states }) => {
            expect(() =>
                s.txn(({ set }) => {
                    set(states.a, 1)
                    set(states.b, 2)
                    throw new Error("txn boom")
                }),
            ).toThrow("txn boom")
        },
        // The commit never ran — no onSet, no subscribers, no onChange, no commitEnd.
        trace: [],
        assert: ({ store: s, states, changes }) => {
            expect(s.get(states.a)).toBe(0) // rolled back
            expect(s.get(states.b)).toBe(0)
            expect(changes).toHaveLength(0)
        },
    },
]

/** The subscriber-cascade case pushes a manual `sub:a` tag (it also performs a
 *  nested write), so it doesn't fit the `traceSub`-only table above. */
const cascadeCase: TraceCase<Ctx> = {
    name: "subscriber cascade — nested write coalesces into the outer commit",
    build: (rec: Recorder) => {
        const s = store()
        const a = tracedAtom(rec, "a", 0)
        const b = tracedAtom(rec, "b", 0)
        let cascaded = false
        s.sub(a, () => {
            rec.push("sub:a")
            if (!cascaded) {
                cascaded = true
                s.set(b, 99) // nested write DURING the outer commit
            }
        })
        traceSub(rec, s, b, "b")
        traceCommitEnd(rec, s)
        return { store: s, changes: [], states: { a, b } }
    },
    act: ({ store: s, states }) => {
        s.set(states.a, 1)
    },
    // Locked to observed behavior: outer set fires onSet:a in the write phase,
    // then subscriber sub:a runs the nested set(b) inline (its own onSet:b +
    // sub:b), and the nested commit coalesces into ONE outer commitEnd.
    trace: ["onSet:a", "sub:a", "onSet:b", "sub:b", "commitEnd"],
    assert: ({ store: s, states }) => {
        expect(s.get(states.a)).toBe(1)
        expect(s.get(states.b)).toBe(99)
    },
}

runTraceTable("trace oracle · single-store transactions", [...cases, cascadeCase])
