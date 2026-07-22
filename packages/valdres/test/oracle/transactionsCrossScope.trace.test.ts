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

type TreeCtx = {
    root: Store
    mid: Store
    leaf: Store
    states: Record<string, Atom<any> | Selector<any>>
    rootChanges: ChangeCall[]
    observed: { spanning?: number }
    run: () => void
    cleanup: () => void
}

/** Depth-3 nested txn: the tree-level commit settles the leaf store once, so
 *  the spanning selector's body runs EXACTLY once — a second `eval:` in the
 *  spine fails this case. Cross-store members of each phase stay bagged. */
const depth3Case: TraceCase<TreeCtx> = {
    name: "depth-3 txn — leaf spanning selector evaluates once, phases block",
    build: (rec: Recorder) => {
        const root = store()
        const mid = root.scope("x3-mid")
        const leaf = mid.scope("x3-leaf")
        const a = tracedAtom(rec, "a", 0)
        const b = tracedAtom(rec, "b", 0)
        const c = tracedAtom(rec, "c", 0)
        mid.set(b, 0)
        leaf.set(c, 0)
        const spanning = tracedSelector(
            rec,
            "leafSel",
            get =>
                (get(a) as number) + (get(b) as number) + (get(c) as number),
        )
        const observed: { spanning?: number } = {}
        leaf.sub(spanning, () => {
            rec.push("sub:leafSel")
            observed.spanning = leaf.get(spanning) as number
        })
        const { calls: rootChanges } = traceChange(rec, root, "root")
        traceCommitEnd(rec, root, "root")

        return {
            root,
            mid,
            leaf,
            states: { a, b, c, spanning },
            rootChanges,
            observed,
            run: () =>
                root.txn(txn => {
                    txn.set(a, 1)
                    txn.scope("x3-mid", midTxn => {
                        midTxn.set(b, 2)
                        midTxn.scope("x3-leaf", leafTxn => {
                            leafTxn.set(c, 3)
                        })
                    })
                }),
            cleanup: () => {
                leaf.detach()
                mid.detach()
            },
        }
    },
    act: ctx => ctx.run(),
    trace: [
        ["onSet:a", "onSet:b", "onSet:c"],
        "eval:leafSel",
        "sub:leafSel",
        "onChange:root",
        "commitEnd:root",
    ],
    assert: ctx => {
        expect(ctx.observed.spanning).toBe(6) // final, fully-applied snapshot
        expect(ctx.rootChanges).toHaveLength(1)
        expect(ctx.rootChanges[0]!.changes).toHaveLength(3)
        ctx.cleanup()
    },
}

/** Root set + scope unset of the same atom in one txn: the scope re-inherits
 *  the value the SAME transaction wrote to the root, the subscriber fires once
 *  with that final value, and the delegate survives for later root writes. */
const setPlusUnsetCase: TraceCase<TreeCtx> = {
    name: "root set + scope unset — re-inherits the new value, one notification",
    build: (rec: Recorder) => {
        const root = store()
        const mid = root.scope("xu-scope")
        const b = tracedAtom(rec, "b", 1)
        mid.set(b, 5) // pre-existing scope shadow
        const observed: { spanning?: number } = {}
        mid.sub(b, () => {
            rec.push("sub:b")
            observed.spanning = mid.get(b) as number
        })
        const { calls: rootChanges } = traceChange(rec, root, "root")
        traceCommitEnd(rec, root, "root")

        return {
            root,
            mid,
            leaf: mid,
            states: { b },
            rootChanges,
            observed,
            run: () =>
                root.txn(txn => {
                    txn.set(b, 7)
                    txn.scope("xu-scope", scoped => scoped.unset(b))
                }),
            cleanup: () => mid.detach(),
        }
    },
    act: ctx => ctx.run(),
    trace: ["onSet:b", "sub:b", "onChange:root", "commitEnd:root"],
    assert: ctx => {
        expect(ctx.root.get(ctx.states.b)).toBe(7)
        expect(ctx.mid.get(ctx.states.b)).toBe(7) // re-inherited the txn's value
        expect(ctx.observed.spanning).toBe(7) // never the stale shadow 5
        // Root group first (set), then the scope's unset record.
        expect(
            ctx.rootChanges[0]!.changes.map((c: any) => c.kind),
        ).toEqual(["set", "unset"])
        // Delegate survives: a later root write still notifies the scope sub.
        ctx.root.set(ctx.states.b, 9)
        expect(ctx.observed.spanning).toBe(9)
        ctx.cleanup()
    },
}

runTraceTable("trace oracle · cross-scope tree commit", [
    depth3Case,
    setPlusUnsetCase,
])
