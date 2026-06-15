import { describe, expect, test } from "bun:test"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"

// Regression tests for two scope × atom-family × transaction propagation-
// soundness bugs found by the differential soundness fuzzer (see the audit).
//
// Both stem from the txn family-index path diverging from the non-txn path
// (initFamilyIndex):
//
//  BUG 1 — broken inheritance for a txn-materialized scope family index.
//    `Transaction.cloneFamilyIntoTxn` built a scope's first family index by
//    flat-cloning `this.get(family)` — which for a read-through scope is the
//    PARENT's rendered index. That snapshotted every inherited member into the
//    scope's OWN `created` map and dropped the `parentIndex` link, and never
//    registered the scope in the parent's `scopeValueIndex`. Consequences:
//      (a) recursivelyUpdateIndexes could never reach the scope, so members the
//          parent ADDED later never appeared in the scope's get(family); and
//      (b) members the parent later DELETED were not removed — the scope's own
//          snapshot copy shadowed the parent's tombstone.
//    Fixed by building a proper child index (empty deltas + parentIndex) and
//    registering via trackScopeValue, mirroring initFamilyIndex.
//
//  BUG 2 — a parent family-member ADD didn't recompute scope selectors.
//    `propagateAtomUpdate` propagated only the changed member atoms into scopes,
//    not the family OBJECT. A scope selector reading get(family) depends on the
//    family object, so its get(family) membership was re-rendered but the
//    selector itself was never re-evaluated — leaving it stale. (General: it
//    reproduces with a plain `set`, no txn.) Fixed by also propagating each
//    changed family to scopes on the add path, mirroring propagateDeletedAtoms.

const keys = (s: any, fam: any) => s.get(fam).map((a: any) => a.familyArgs[0]).sort()

// Atom/family names are registered in a process-global registry (duplicates
// throw), so families created per loop iteration get a unique suffix.
let uid = 0

describe("scope × family × txn propagation soundness", () => {
    // BUG 1 (a): parent ADDs after a txn-materialized scope index.
    test("scope sees parent family members added after the scope's index was created in a txn", () => {
        for (const makeScopeMember of [
            (S: any, fam: any) => S.set(fam("sk"), 9), // non-txn baseline (always worked)
            (S: any, fam: any) => S.txn((t: any) => t.set(fam("sk"), 9)), // scope-only txn
            (root: any, S: any, fam: any, viaCross = true) => {}, // placeholder, replaced below
        ].slice(0, 2)) {
            const fam = atomFamily<number, [string]>(() => 0, { name: `f${++uid}` })
            const root = store()
            const S = root.scope("c")
            root.set(fam("rk0"), 1)
            makeScopeMember(S, fam)
            // root adds more members AFTER the scope materialized its index
            root.set(fam("rk1"), 2)
            root.txn((t: any) => {
                t.set(fam("rk2"), 3)
                t.set(fam("rk3"), 4)
            })
            expect(keys(S, fam)).toEqual(["rk0", "rk1", "rk2", "rk3", "sk"])
        }
    })

    test("scope (index created via cross-scope txn) sees later parent additions", () => {
        const fam = atomFamily<number, [string]>(() => 0, { name: "fx" })
        const root = store()
        const S = root.scope("c")
        root.txn((t: any) => t.set(fam("rk0"), 1))
        // cross-scope txn materializes the scope's own family index
        root.txn((t: any) => t.scope("c", (ct: any) => ct.set(fam("sk"), 9)))
        root.txn((t: any) => {
            t.set(fam("rk1"), 2)
            t.set(fam("rk2"), 3)
        })
        expect(keys(S, fam)).toEqual(["rk0", "rk1", "rk2", "sk"])
    })

    // BUG 1 (b): parent DELETE cascades into a txn-materialized scope index.
    test("parent delete of an inherited member drops it from a txn-materialized scope index", () => {
        for (const [label, makeMember, del] of [
            ["S.txn / plain del", (S: any, fam: any) => S.txn((t: any) => t.set(fam("sk"), 9)), (r: any, fam: any) => r.del(fam("rk0"))],
            ["S.txn / txn del", (S: any, fam: any) => S.txn((t: any) => t.set(fam("sk"), 9)), (r: any, fam: any) => r.txn((t: any) => t.del(fam("rk0")))],
        ] as const) {
            const fam = atomFamily<number, [string]>(() => 0, { name: `fd${++uid}` })
            const root = store()
            const S = root.scope("c")
            root.set(fam("rk0"), 1)
            makeMember(S, fam)
            expect(keys(S, fam)).toEqual(["rk0", "sk"]) // scope inherits rk0
            del(root, fam)
            expect(keys(S, fam)).toEqual(["sk"]) // rk0 removed from the scope too
            expect(keys(root, fam)).toEqual([])
        }
    })

    // A throwing scope transaction must not corrupt the store. Registering the
    // scope in scopeValueIndex happens at commit (setValueInData), not in the txn
    // body, so an aborted txn leaves nothing registered and a later parent family
    // write can't deref a scope that never received its index. (Regression guard:
    // an earlier version of the fix registered in the txn body and crashed here.)
    test("a throwing scope txn does not corrupt later parent family writes", () => {
        const fam = atomFamily<number, [string]>(() => 0, { name: "ft" })
        const root = store()
        const S = root.scope("c")
        root.set(fam("a"), 1)
        expect(() =>
            S.txn((t: any) => {
                t.set(fam("b"), 2)
                throw new Error("user code failed")
            }),
        ).toThrow()
        expect(() => root.set(fam("c"), 3)).not.toThrow()
        expect(keys(root, fam)).toEqual(["a", "c"])
    })

    // A GRANDCHILD scope (root → B → C) that first materializes its family index
    // via a SCOPE-ONLY txn while the intermediate scope B has no index must still
    // observe later parent member adds. The txn lands a flat index that skips B;
    // ensureFamilyAncestorChain (reusing initFamilyIndex's chain walk at commit)
    // materializes + registers B so recursivelyUpdateIndexes can reach C. Plain
    // C.set and a cross-scope txn from the root were already correct.
    test("grandchild scope sees parent adds after scope-only txn materialization", () => {
        for (const materialize of [
            (C: any, fam: any) => C.txn((t: any) => t.set(fam("c0"), 9)),
            (C: any, fam: any) => C.set(fam("c0"), 9),
            (_C: any, _fam: any, root?: any) => {}, // replaced below
        ].slice(0, 2)) {
            const fam = atomFamily<number, [string]>(() => 0, { name: `fg${++uid}` })
            const root = store()
            const B = root.scope("B")
            const C = B.scope("C")
            root.set(fam("r0"), 1)
            materialize(C, fam)
            root.set(fam("r1"), 2)
            root.txn((t: any) => t.set(fam("r2"), 3))
            expect(keys(C, fam)).toEqual(["c0", "r0", "r1", "r2"])
            // B (intermediate, never written directly) inherits the full root set
            expect(keys(B, fam)).toEqual(["r0", "r1", "r2"])
        }
    })

    // 3-level nesting (root → B → C): the ancestor-chain walk must hold across
    // cross-scope txns, sequential per-scope txns, and parent deletes — so an
    // intermediate scope is always materialized and every level stays in sync.
    test("3-level cross-scope txn: members at each level, later parent/intermediate adds", () => {
        const fam = atomFamily<number, [string]>(() => 0, { name: "x3a" })
        const root = store()
        const B = root.scope("B")
        const C = B.scope("C")
        root.txn((t: any) => {
            t.set(fam("r0"), 1)
            t.scope("B", (bt: any) => {
                bt.set(fam("b0"), 2)
                bt.scope("C", (ct: any) => ct.set(fam("c0"), 3))
            })
        })
        expect(keys(C, fam)).toEqual(["b0", "c0", "r0"])
        expect(keys(B, fam)).toEqual(["b0", "r0"])
        root.set(fam("r1"), 4)
        B.set(fam("b1"), 5)
        expect(keys(C, fam)).toEqual(["b0", "b1", "c0", "r0", "r1"])
    })

    test("3-level sequential txns then parent add/delete reach the grandchild", () => {
        const fam = atomFamily<number, [string]>(() => 0, { name: "x3b" })
        const root = store()
        const B = root.scope("B")
        const C = B.scope("C")
        root.set(fam("r0"), 1)
        B.txn((t: any) => t.set(fam("b0"), 2))
        C.txn((t: any) => t.set(fam("c0"), 3))
        root.set(fam("r1"), 4)
        expect(keys(C, fam)).toEqual(["b0", "c0", "r0", "r1"])
        expect(keys(B, fam)).toEqual(["b0", "r0", "r1"])
        root.del(fam("r0"))
        expect(keys(C, fam)).toEqual(["b0", "c0", "r1"])
    })

    // Propagating the family OBJECT into scopes is gated on a MEMBERSHIP change
    // (perf: a value-update of an existing member otherwise re-evaluated every
    // scope). This guards that the gate didn't break value-update propagation: a
    // scope selector reading a member's value still recomputes (via the member
    // atom), while a membership-only selector correctly does NOT change.
    test("value-update of an existing member recomputes scope selectors via the member", () => {
        const fam = atomFamily<number, [string]>(() => 0, { name: "fv" })
        const sum = selector(get => (get(fam) as any[]).reduce((a, m) => a + (get(m) as number), 0), { name: "vsum" })
        const count = selector(get => (get(fam) as any[]).length, { name: "vcount" })
        const root = store()
        const S = root.scope("c")
        root.set(fam("a"), 5)
        S.sub(sum, () => {})
        S.sub(count, () => {})
        expect(S.get(sum)).toBe(5)
        expect(S.get(count)).toBe(1)
        root.set(fam("a"), 9) // value update, membership unchanged
        expect(S.get(sum)).toBe(9) // recomputes via the member atom
        expect(S.get(count)).toBe(1) // membership-only selector unchanged
    })

    // Perf-regression guard (deterministic, no benchmark needed): a value-update
    // of an existing member must NOT re-evaluate a scope selector that depends
    // only on family MEMBERSHIP — otherwise the family was propagated into every
    // scope on every member write (the +74% "family update, 100 scopes"
    // regression). A membership change MUST re-evaluate it. Counts selector-body
    // executions in a scope; reverting the membership gate makes the value-update
    // assertion fail.
    test("value-update does not re-evaluate a scope membership selector; a membership change does", () => {
        const fam = atomFamily<number, [string]>(() => 0, { name: "fp" })
        let evals = 0
        const famCount = selector(get => { evals++; return (get(fam) as any[]).length }, { name: "famCount" })
        const root = store()
        const S = root.scope("c")
        root.set(fam("a"), 5)
        S.sub(famCount, () => {}) // materializes famCount in the scope (depends on the family object)
        const base = evals
        root.set(fam("a"), 6) // value-updates of an existing member
        root.set(fam("a"), 7)
        root.set(fam("a"), 8)
        expect(evals).toBe(base) // membership unchanged ⇒ scope selector not re-run
        root.set(fam("b"), 1) // membership change (new member)
        expect(evals).toBe(base + 1) // re-run exactly once
    })

    // BUG 2: a scope selector that reads get(family) recomputes on a parent add.
    test("scope selector reading get(family) recomputes when the parent adds a member", () => {
        for (const makeScopeMember of [
            null, // scope only inherits
            (S: any, fam: any) => S.set(fam("sk"), 5),
            (S: any, fam: any) => S.txn((t: any) => t.set(fam("sk"), 5)),
        ]) {
            const fam = atomFamily<number, [string]>(() => 0, { name: `fs${++uid}` })
            const sum = selector(
                get => (get(fam) as any[]).reduce((a, m) => a + (get(m) as number), 0),
                { name: "sum" },
            )
            const root = store()
            const S = root.scope("c")
            if (makeScopeMember) makeScopeMember(S, fam)
            S.sub(sum, () => {})
            const before = S.get(sum)
            root.set(fam("rk"), 4) // parent adds a member the scope inherits
            expect(S.get(sum)).toBe(before + 4)
        }
    })
})
