/** Trace oracle · cross-scope transactions.
 *
 *  A transaction spanning a root and its scope commits as ONE atomic unit: no
 *  subscriber (and no selector a subscriber reads) ever observes a half-applied
 *  transaction. Cross-store position within a phase is INCIDENTAL (Map/Set
 *  insertion order), so this suite locks only the phase *blocks* — onSet* then
 *  sub* then onChange* then commitEnd* — and treats each block as an order-free
 *  bag, mirroring the `.slice().sort()` convention in `onCommitEnd.test.ts`. */
import { expect } from "bun:test"
import { store } from "../../src/store"
import type { Atom } from "../../src/types/Atom"
import type { Selector } from "../../src/types/Selector"
import type { Store } from "../../src/types/Store"
import { runTraceTable, type TraceCase } from "./runTable"
import {
    type ChangeCall,
    type Recorder,
    traceChange,
    traceCommitEnd,
    tracedAtom,
    tracedSelector,
    traceSub,
} from "./traceRecorder"

type Ctx = {
    root: Store
    child: Store
    states: Record<string, Atom<any> | Selector<any>>
    rootChanges: ChangeCall[]
    childChanges: ChangeCall[]
    observed: { crossRead?: number }
    run: () => void
    cleanup: () => void
}

const atomicCase: TraceCase<Ctx> = {
    name: "cross-scope txn — atomic; phases block, cross-store order is a bag",
    build: (rec: Recorder) => {
        const root = store()
        const child = root.scope("xscope-atomic")
        const a = tracedAtom(rec, "a", 0)
        const b = tracedAtom(rec, "b", 0)
        child.set(b, 0) // pin a shadow of b in the scope (equal set still shadows)

        const observed: { crossRead?: number } = {}
        // A root subscriber that reads the SCOPE's atom must see the final value.
        root.sub(a, () => {
            rec.push("sub:a")
            observed.crossRead = child.get(b) as number
        })
        traceSub(rec, child, b, "b")
        const { calls: rootChanges } = traceChange(rec, root, "root")
        const { calls: childChanges } = traceChange(rec, child, "scope")
        traceCommitEnd(rec, root, "root")
        traceCommitEnd(rec, child, "scope")

        return {
            root,
            child,
            states: { a, b },
            rootChanges,
            childChanges,
            observed,
            run: () =>
                root.txn(txn => {
                    txn.set(a, 1)
                    txn.scope("xscope-atomic", st => st.set(b, 2))
                }),
            cleanup: () => child.detach(),
        }
    },
    act: ctx => ctx.run(),
    trace: [
        ["onSet:a", "onSet:b"],
        ["sub:a", "sub:b"],
        ["onChange:root", "onChange:scope"],
        ["commitEnd:root", "commitEnd:scope"],
    ],
    assert: ctx => {
        expect(ctx.root.get(ctx.states.a)).toBe(1)
        expect(ctx.child.get(ctx.states.b)).toBe(2)
        expect(ctx.observed.crossRead).toBe(2) // atomicity: never a half-applied 0
        // Root listener aggregates root + descendant-scope changes (one call, two
        // changes); the scope listener sees only its own change.
        expect(ctx.rootChanges).toHaveLength(1)
        expect(ctx.rootChanges[0]!.changes).toHaveLength(2)
        expect(ctx.childChanges).toHaveLength(1)
        expect(ctx.childChanges[0]!.changes).toHaveLength(1)
        ctx.cleanup()
    },
}

const scopeSelectorCase: TraceCase<Ctx> = {
    name: "root write recomputes a scope selector once; scope subscriber sees final value",
    build: (rec: Recorder) => {
        const root = store()
        const child = root.scope("xscope-sel")
        const a = tracedAtom(rec, "a", 1)
        // Lives in the child; depends on the (inherited) root atom `a`.
        const childSel = tracedSelector(
            rec,
            "childSel",
            get => (get(a) as number) * 10,
        )

        const observed: { crossRead?: number } = {}
        traceSub(rec, root, a, "a")
        child.sub(childSel, () => {
            rec.push("sub:childSel")
            observed.crossRead = child.get(childSel) as number
        })
        const { calls: rootChanges } = traceChange(rec, root, "root", {
            selectors: true,
        })
        const { calls: childChanges } = traceChange(rec, child, "scope", {
            selectors: true,
        })
        traceCommitEnd(rec, root, "root")

        return {
            root,
            child,
            states: { a, childSel },
            rootChanges,
            childChanges,
            observed,
            run: () => root.set(a, 5),
            cleanup: () => child.detach(),
        }
    },
    act: ctx => ctx.run(),
    // onSet (write phase) → eval of the scope selector (propagation) → subs →
    // onChange → commitEnd. Cross-store members of each phase are bagged.
    trace: [
        "onSet:a",
        "eval:childSel",
        ["sub:a", "sub:childSel"],
        ["onChange:root", "onChange:scope"],
        "commitEnd:root",
    ],
    assert: ctx => {
        expect(ctx.root.get(ctx.states.a)).toBe(5)
        expect(ctx.child.get(ctx.states.childSel)).toBe(50)
        expect(ctx.observed.crossRead).toBe(50) // recomputed to the final value
        ctx.cleanup()
    },
}

runTraceTable("trace oracle · cross-scope transactions", [
    atomicCase,
    scopeSelectorCase,
])
