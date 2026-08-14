/** Trace oracle · direct set & bulk set.
 *
 *  Locks the observable spine for `store.set` (value + updater), a no-op (equal)
 *  set that must not commit, and a bulk multi-atom write via `store.txn`. */
import { expect } from "../performance/test-compat"
import { store } from "../../src/store"
import type { Atom } from "../../src/types/Atom"
import type { Selector } from "../../src/types/Selector"
import type { Store } from "../../src/types/Store"
import { runTraceTable, type TraceCase } from "./runTable"
import {
    type ChangeCall,
    traceChange,
    traceCommitEnd,
    tracedAtom,
    tracedSelector,
    traceSub,
} from "./traceRecorder"

type State = Atom<any> | Selector<any>
type Ctx = {
    store: Store
    changes: ChangeCall[]
    states: Record<string, State>
}

const cases: TraceCase<Ctx>[] = [
    {
        name: "direct set (value) — onSet → sub → onChange → commitEnd",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 0)
            traceSub(rec, s, a, "a")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a } }
        },
        act: ({ store: s, states }) => {
            s.set(states.a as Atom<number>, 1)
        },
        trace: ["onSet:a", "sub:a", "onChange", "commitEnd"],
        assert: ({ store: s, states, changes }) => {
            expect(s.get(states.a)).toBe(1)
            expect(changes.map(c => c.meta.source)).toEqual(["set"])
        },
    },
    {
        name: "direct set (updater fn) — same spine, current+1",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 10)
            s.get(a) // materialize
            traceSub(rec, s, a, "a")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a } }
        },
        act: ({ store: s, states }) => {
            s.set(states.a as Atom<number>, (c: number) => c + 1)
        },
        trace: ["onSet:a", "sub:a", "onChange", "commitEnd"],
        assert: ({ store: s, states }) => expect(s.get(states.a)).toBe(11),
    },
    {
        name: "no-op set (equal value) — no commit, empty trace",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 5)
            s.get(a) // materialize so an equal set is a true no-op
            traceSub(rec, s, a, "a")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a } }
        },
        act: ({ store: s, states }) => {
            s.set(states.a as Atom<number>, 5)
        },
        trace: [],
        assert: ({ store: s, states, changes }) => {
            expect(s.get(states.a)).toBe(5)
            expect(changes).toHaveLength(0)
        },
    },
    {
        name: "direct set feeding a selector — onSet → eval → subs → onChange → commitEnd",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 1)
            const double = tracedSelector(rec, "double", get => get(a) * 2)
            traceSub(rec, s, a, "a")
            traceSub(rec, s, double, "double")
            const { calls } = traceChange(rec, s, undefined, { selectors: true })
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a, double } }
        },
        act: ({ store: s, states }) => {
            s.set(states.a as Atom<number>, 2)
        },
        // eval is locked before subs (dep order); the two subs are an incidental bag.
        trace: [
            "onSet:a",
            "eval:double",
            ["sub:a", "sub:double"],
            "onChange",
            "commitEnd",
        ],
        assert: ({ store: s, states }) => expect(s.get(states.double)).toBe(4),
    },
    {
        name: "bulk set via txn — one commit, source 'transaction', onSet in write order",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 0)
            const b = tracedAtom(rec, "b", 0)
            const sum = tracedSelector(rec, "sum", get => get(a) + get(b))
            traceSub(rec, s, a, "a")
            traceSub(rec, s, b, "b")
            traceSub(rec, s, sum, "sum")
            const { calls } = traceChange(rec, s, undefined, { selectors: true })
            traceCommitEnd(rec, s)
            return { store: s, changes: calls, states: { a, b, sum } }
        },
        act: ({ store: s, states }) =>
            s.txn(({ set }) => {
                set(states.a as Atom<number>, 3)
                set(states.b as Atom<number>, 4)
            }),
        // onSet order (a before b) is contractual — it follows write order.
        // sum evaluates once; the three subs are an incidental bag.
        trace: [
            "onSet:a",
            "onSet:b",
            "eval:sum",
            ["sub:a", "sub:b", "sub:sum"],
            "onChange",
            "commitEnd",
        ],
        assert: ({ store: s, states, changes }) => {
            expect(s.get(states.sum)).toBe(7)
            expect(changes.map(c => c.meta.source)).toEqual(["transaction"])
        },
    },
]

runTraceTable("trace oracle · direct & bulk set", cases)
