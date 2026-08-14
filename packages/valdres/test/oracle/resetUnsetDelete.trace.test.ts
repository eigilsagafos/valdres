/** Trace oracle · reset / unset / delete.
 *
 *  These three verbs are easy to conflate in a refactor but have distinct
 *  observable semantics:
 *    - reset  → eagerly writes the default back (source "reset", kind "set")
 *    - unset  → drops the store's own value (source "unset", kind "unset");
 *               a root reverts to default, a scope re-inherits its parent
 *    - delete → removes a family member (source "delete", kind "delete")
 *  Each is one commit; a no-op unset must not commit. */
import { expect } from "../performance/test-compat"
import { atom } from "../../src/atom"
import { atomFamily } from "../../src/atomFamily"
import { store } from "../../src/store"
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

type Ctx = {
    store: Store
    changes: ChangeCall[]
    act: () => void
    /** value read back after the op */
    read: () => unknown
}

/** Every change discriminator reported to onChange, in order. Selectors have
 *  no `kind`, so name them explicitly instead of relying on Bun's matcher
 *  treating a trailing `undefined` array entry as absent. */
const kinds = (calls: ChangeCall[]): string[] =>
    calls.flatMap(c =>
        c.changes.map(ch => (ch.type === "atom" ? ch.kind : "selector")),
    )

const cases: TraceCase<Ctx>[] = [
    {
        name: "reset — eagerly writes default back (onSet fires), source 'reset'",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 1)
            const double = tracedSelector(rec, "double", get => get(a) * 2)
            s.set(a, 5)
            traceSub(rec, s, a, "a")
            traceSub(rec, s, double, "double")
            const { calls } = traceChange(rec, s, undefined, {
                selectors: true,
            })
            traceCommitEnd(rec, s)
            return {
                store: s,
                changes: calls,
                act: () => s.reset(a),
                read: () => s.get(a),
            }
        },
        act: ctx => ctx.act(),
        trace: [
            "onSet:a",
            "eval:double",
            ["sub:a", "sub:double"],
            "onChange",
            "commitEnd",
        ],
        assert: ({ changes, read }) => {
            expect(read()).toBe(1)
            expect(changes.map(c => c.meta.source)).toEqual(["reset"])
            expect(kinds(changes)).toEqual(["set", "selector"])
        },
    },
    {
        name: "reset never-materialized selector default reports only reset atom",
        build: rec => {
            const s = store()
            const dependency = atom(10)
            const defaultValue = tracedSelector(
                rec,
                "default",
                get => get(dependency) + 1,
            )
            const a = atom(defaultValue)
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return {
                store: s,
                changes: calls,
                act: () => s.reset(a),
                read: () => s.get(a),
            }
        },
        act: ctx => ctx.act(),
        trace: ["eval:default", "onChange", "commitEnd"],
        assert: ({ changes, read }) => {
            expect(read()).toBe(11)
            expect(changes).toHaveLength(1)
            expect(changes[0]?.meta.source).toBe("reset")
            expect(changes[0]?.changes).toHaveLength(1)
            expect(changes[0]?.changes[0]).toMatchObject({
                type: "atom",
                kind: "set",
                value: 11,
                scope: [],
            })
        },
    },
    {
        name: "unset on root — reverts to default, no onSet, kind 'unset'",
        build: rec => {
            const s = store()
            const a = tracedAtom(rec, "a", 1)
            const double = tracedSelector(rec, "double", get => get(a) * 2)
            s.set(a, 5)
            traceSub(rec, s, double, "double")
            const { calls } = traceChange(rec, s, undefined, {
                selectors: true,
            })
            traceCommitEnd(rec, s)
            return {
                store: s,
                changes: calls,
                act: () => s.unset(a),
                read: () => s.get(a),
            }
        },
        act: ctx => ctx.act(),
        trace: ["eval:double", "sub:double", "onChange", "commitEnd"],
        assert: ({ changes, read }) => {
            expect(read()).toBe(1)
            expect(changes.map(c => c.meta.source)).toEqual(["unset"])
            expect(kinds(changes)).toEqual(["unset", "selector"])
        },
    },
    {
        name: "unset with no own value — no-op, empty trace",
        build: rec => {
            const s = store()
            // Never read/subscribe `a` before the unset: reading OR subscribing
            // materializes the default into the store's own values, which would
            // make the unset a real change. An untouched atom has no own value.
            const a = tracedAtom(rec, "a", 1)
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            return {
                store: s,
                changes: calls,
                act: () => s.unset(a),
                read: () => s.get(a),
            }
        },
        act: ctx => ctx.act(),
        trace: [],
        assert: ({ changes, read }) => {
            expect(read()).toBe(1)
            expect(changes).toHaveLength(0)
        },
    },
    {
        name: "unset on scope — re-inherits the parent value, kind 'unset'",
        build: rec => {
            const root = store()
            const a = atom(1)
            root.set(a, 7) // parent value
            const child = root.scope("rud-unset-scope")
            child.set(a, 99) // shadow in the scope
            traceSub(rec, child, a, "a")
            const { calls } = traceChange(rec, child)
            traceCommitEnd(rec, child)
            return {
                store: child,
                changes: calls,
                act: () => child.unset(a),
                read: () => child.get(a),
            }
        },
        act: ctx => ctx.act(),
        trace: ["sub:a", "onChange", "commitEnd"],
        assert: ({ changes, read }) => {
            expect(read()).toBe(7) // re-inherited the parent's current value
            expect(changes.map(c => c.meta.source)).toEqual(["unset"])
            expect(kinds(changes)).toEqual(["unset"])
        },
    },
    {
        name: "delete a family member — source 'delete', kind 'delete'",
        build: rec => {
            const s = store()
            const fam = atomFamily<number, [string]>(0)
            const x = fam("x")
            const count = tracedSelector(rec, "count", get => get(fam).length)
            s.set(x, 1)
            traceSub(rec, s, x, "x")
            traceSub(rec, s, count, "count")
            const { calls } = traceChange(rec, s, undefined, {
                selectors: true,
            })
            traceCommitEnd(rec, s)
            return {
                store: s,
                changes: calls,
                act: () => s.del(x),
                read: () => s.get(x),
            }
        },
        act: ctx => ctx.act(),
        trace: ["eval:count", ["sub:x", "sub:count"], "onChange", "commitEnd"],
        assert: ({ changes, read }) => {
            expect(read()).toBe(0) // reverts to the family default
            expect(changes.map(c => c.meta.source)).toEqual(["delete"])
            expect(kinds(changes)).toEqual(["delete", "selector"])
        },
    },
]

runTraceTable("trace oracle · reset / unset / delete", cases)
