import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"

// A single store.txn() that writes to the root and to one or more scopes must
// be observed atomically: no subscriber, onSet hook, or selector should ever
// see a state where part of the transaction (one store/scope) is applied but
// another isn't. The final committed state was always consistent; what these
// tests pin is that every *observation point* (subscriber, selector recompute,
// onSet hook) sees the fully-applied transaction.

describe("cross-scope transactions are atomically observable", () => {
    describe("single scope", () => {
        test("root subscriber never sees root=new while scope=old", () => {
            const root = store()
            const S = root.scope("S")

            const r = atom(1, { name: "r" })
            const s = atom(10, { name: "s" })

            // Establish a scope-local shadow for `s` before the txn.
            S.set(s, 10)

            const observed: Array<[number, number]> = []
            root.sub(r, () => {
                observed.push([root.get(r), S.get(s)])
            })

            root.txn(t => {
                t.set(r, 2)
                t.scope("S", st => st.set(s, 20))
            })

            // The subscriber must only ever observe the fully-applied state.
            expect(observed).toEqual([[2, 20]])
        })

        test("selector spanning root + scope is notified once with final values", () => {
            const root = store()
            const S = root.scope("S")

            const r = atom(1, { name: "r2" })
            const s = atom(10, { name: "s2" })
            S.set(s, 10)

            const sum = selector(get => get(r) + get(s), { name: "sum" })

            const observed: number[] = []
            const cb = mock(() => {
                observed.push(S.get(sum))
            })
            S.sub(sum, cb)
            expect(S.get(sum)).toBe(11)

            root.txn(t => {
                t.set(r, 2)
                t.scope("S", st => st.set(s, 20))
            })

            // Final value is 22. The intermediate half-applied value
            // (2 + 10 = 12) must never be observed.
            expect(observed).not.toContain(12)
            expect(observed).toEqual([22])
            expect(S.get(sum)).toBe(22)
        })

        test("scope newly shadows a root atom with the same value root is set to", () => {
            // Regression for the leaf-first write order. The scope creates its
            // first shadow of X *in this txn*, set to the exact value the root
            // is simultaneously setting X to. The scope's selector was reading
            // the inherited value (0) and must recompute to 5 — even though the
            // scope's shadow numerically equals the root's new value. Writing
            // parent-first would mask this (getState would already return 5) and
            // the root's propagateToScopes would skip the now-shadowing scope.
            const root = store()
            const S = root.scope("S")
            const X = atom(0, { name: "ns-x" })

            const sel = selector(get => get(X), { name: "ns-sel" })
            const cb = mock(() => {})
            S.sub(sel, cb)
            expect(S.get(sel)).toBe(0)

            root.txn(t => {
                t.set(X, 5)
                t.scope("S", st => st.set(X, 5))
            })

            expect(S.get(sel)).toBe(5)
            expect(cb).toHaveBeenCalledTimes(1)
            // Root side is unaffected.
            expect(root.get(X)).toBe(5)
        })

        test("scope shadow + root write in one txn: each side sees its own final value", () => {
            const root = store()
            const S = root.scope("S")
            const x = atom(0, { name: "shadow-x" })
            // Establish the shadow (and re-root S's subscription) before the txn.
            S.set(x, 50)

            const rootSeen: Array<[number, number]> = []
            const scopeSeen: Array<[number, number]> = []
            root.sub(x, () => rootSeen.push([root.get(x), S.get(x)]))
            S.sub(x, () => scopeSeen.push([root.get(x), S.get(x)]))

            root.txn(t => {
                t.set(x, 1)
                t.scope("S", st => st.set(x, 100))
            })

            expect(root.get(x)).toBe(1)
            expect(S.get(x)).toBe(100)
            // Both observers see the same fully-applied snapshot.
            expect(rootSeen).toEqual([[1, 100]])
            expect(scopeSeen).toEqual([[1, 100]])
        })
    })

    describe("multiple scopes", () => {
        test("every observer sees all scopes applied, each fires once", () => {
            const root = store()
            const A = root.scope("A")
            const B = root.scope("B")

            const r = atom(0, { name: "m-r" })
            const a = atom(0, { name: "m-a" })
            const b = atom(0, { name: "m-b" })
            A.set(a, 0)
            B.set(b, 0)

            const snapshots: Array<[string, number, number, number]> = []
            root.sub(r, () =>
                snapshots.push(["root", root.get(r), A.get(a), B.get(b)]),
            )
            A.sub(a, () =>
                snapshots.push(["A", root.get(r), A.get(a), B.get(b)]),
            )
            B.sub(b, () =>
                snapshots.push(["B", root.get(r), A.get(a), B.get(b)]),
            )

            root.txn(t => {
                t.set(r, 1)
                t.scope("A", st => st.set(a, 2))
                t.scope("B", st => st.set(b, 3))
            })

            // Regardless of which store is being notified, the full final
            // state [1, 2, 3] is visible.
            for (const [, rv, av, bv] of snapshots) {
                expect([rv, av, bv]).toEqual([1, 2, 3])
            }
            expect(snapshots.length).toBe(3)
        })

        test("scope A's subscriber sees scope B's write in the same txn", () => {
            const root = store()
            const A = root.scope("A")
            const B = root.scope("B")
            const a = atom(0, { name: "ab-a" })
            const b = atom(0, { name: "ab-b" })
            A.set(a, 0)
            B.set(b, 0)

            const seen: number[] = []
            A.sub(a, () => seen.push(B.get(b)))

            root.txn(t => {
                t.scope("A", st => st.set(a, 1))
                t.scope("B", st => st.set(b, 2))
            })

            expect(seen).toEqual([2])
        })
    })

    describe("nested scopes", () => {
        test("deep observer sees every level applied, in one notification", () => {
            const root = store()
            const S = root.scope("S")
            const N = S.scope("N")

            const r = atom(0, { name: "n-r" })
            const s = atom(0, { name: "n-s" })
            const n = atom(0, { name: "n-n" })
            S.set(s, 0)
            N.set(n, 0)

            const span = selector(
                get => `${get(r)}-${get(s)}-${get(n)}`,
                { name: "n-span" },
            )
            const seen: string[] = []
            N.sub(span, () => seen.push(N.get(span)))
            expect(N.get(span)).toBe("0-0-0")

            root.txn(t => {
                t.set(r, 1)
                t.scope("S", st => {
                    st.set(s, 2)
                    st.scope("N", nt => nt.set(n, 3))
                })
            })

            expect(seen).toEqual(["1-2-3"])
            expect(N.get(span)).toBe("1-2-3")
        })

        test("newly shadow same-as-root value at an INTERMEDIATE scope", () => {
            // Same hazard as the single-scope newly-shadow regression, but the
            // shadow is created at an intermediate level (A) of root → A → B.
            // A's own selector must recompute even though A's shadow equals the
            // root's new value. Exercises leaf-first ordering at depth.
            const root = store()
            const A = root.scope("A")
            A.scope("B")
            const X = atom(0, { name: "i-x" })

            const sel = selector(get => get(X), { name: "i-sel" })
            const cb = mock(() => {})
            A.sub(sel, cb)
            expect(A.get(sel)).toBe(0)

            root.txn(t => {
                t.set(X, 5)
                t.scope("A", st => st.set(X, 5))
            })

            expect(A.get(sel)).toBe(5)
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("shadow at intermediate scope, observed through a leaf selector", () => {
            // The shadow is pinned at A; the observer is a selector in the leaf
            // B (which inherits X from A). When root and A both set X=5, B must
            // recompute to 5 and be notified exactly once — the root→A→B
            // cross-propagation has to reach B through the shadowing intermediate.
            const root = store()
            const A = root.scope("A")
            const B = A.scope("B")
            const X = atom(0, { name: "i2-x" })

            const sel = selector(get => get(X), { name: "i2-sel" })
            const cb = mock(() => {})
            B.sub(sel, cb)
            expect(B.get(sel)).toBe(0)

            root.txn(t => {
                t.set(X, 5)
                t.scope("A", st => st.set(X, 5))
            })

            expect(B.get(sel)).toBe(5)
            expect(cb).toHaveBeenCalledTimes(1)
        })
    })

    describe("parentScope", () => {
        test("root subscriber sees a child write reached via parentScope", () => {
            const root = store()
            const child = root.scope("C")
            const r = atom(0, { name: "ps-r" })
            const c = atom(0, { name: "ps-c" })
            child.set(c, 0)

            const seen: Array<[number, number]> = []
            root.sub(r, () => seen.push([root.get(r), child.get(c)]))

            child.txn(t => {
                t.set(c, 5)
                t.parentScope(pt => pt.set(r, 9))
            })

            expect(seen).toEqual([[9, 5]])
        })
    })

    describe("onSet timing", () => {
        test("onSet on a root atom sees the scope write and fires before subscribers", () => {
            const root = store()
            const S = root.scope("S")
            const s = atom(0, { name: "ot-s" })
            S.set(s, 0)

            const order: Array<[string, number]> = []
            const r = atom(0, {
                name: "ot-r",
                onSet: () => order.push(["onSet:r", S.get(s)]),
            })
            root.sub(r, () => order.push(["sub:r", S.get(s)]))

            root.txn(t => {
                t.set(r, 1)
                t.scope("S", st => st.set(s, 7))
            })

            // onSet observes the fully-applied scope value (7), and fires
            // before the subscriber — preserving the legacy relative order.
            expect(order).toEqual([
                ["onSet:r", 7],
                ["sub:r", 7],
            ])
        })

        test("onSet in scope A sees scope B's write in the same txn", () => {
            const root = store()
            const A = root.scope("A")
            const B = root.scope("B")
            const b = atom(0, { name: "ob-b" })
            const seen: number[] = []
            const a = atom(0, {
                name: "ob-a",
                onSet: () => seen.push(B.get(b)),
            })
            A.set(a, 0)
            B.set(b, 0)

            root.txn(t => {
                t.scope("A", st => st.set(a, 1))
                t.scope("B", st => st.set(b, 2))
            })

            expect(seen).toEqual([2])
        })

        test("onSet on a scope atom is deferred until the root write also lands", () => {
            // The distinguishing test for deferral: writes run leaf-first, so the
            // scope atom is written BEFORE the root atom. If onSet fired inline
            // during the write loop it would observe the not-yet-written root
            // value (0). Deferring every onSet to the notify phase — after all
            // writes — guarantees it sees the fully-applied root value.
            const root = store()
            const S = root.scope("S")
            const r = atom(0, { name: "od-r" })
            const seen: number[] = []
            const a = atom(0, {
                name: "od-a",
                onSet: () => seen.push(root.get(r)),
            })
            S.set(a, 0) // S shadows `a` so the scope (written first) sets it

            root.txn(t => {
                t.set(r, 7) // root written last (leaf-first)
                t.scope("S", st => st.set(a, 1))
            })

            expect(seen).toEqual([7]) // never the inline-observed 0
        })

        test("onSet still fires inline (mid-write-loop) for a non-scoped txn", () => {
            // The single-store fast path is unchanged: onSet fires during the
            // write loop, before subscribers, exactly as before.
            const root = store()
            const order: string[] = []
            const a = atom(0, {
                name: "inline-a",
                onSet: () => order.push("onSet:a"),
            })
            const b = atom(0, {
                name: "inline-b",
                onSet: () => order.push("onSet:b"),
            })
            root.sub(a, () => order.push("sub:a"))
            root.sub(b, () => order.push("sub:b"))

            root.txn(t => {
                t.set(a, 1)
                t.set(b, 1)
            })

            // Both onSets fire during the write loop, then subscribers.
            expect(order).toEqual(["onSet:a", "onSet:b", "sub:a", "sub:b"])
        })
    })

    describe("deletes within a cross-scope txn", () => {
        test("family delete at root + scope write observed atomically", () => {
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "del-fam" })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")

            const S = root.scope("S")
            const s = atom(0, { name: "del-s" })
            S.set(s, 0)

            const count = selector(get => get(fam).length, {
                name: "del-count",
            })
            const seen: Array<[number, number]> = []
            root.sub(count, () => seen.push([root.get(count), S.get(s)]))
            expect(root.get(count)).toBe(2)

            root.txn(t => {
                t.del(m2)
                t.scope("S", st => st.set(s, 9))
            })

            // The count subscriber observes the deletion AND the scope write
            // together — never count=1 while the scope is still old.
            expect(seen).toEqual([[1, 9]])
            expect(root.get(count)).toBe(1)
        })

        test("cross-scope delete removes the member value and notifies its direct subscriber", () => {
            // A family-index write alone makes a `length` selector look right, so
            // assert the parts that ONLY the delete pass provides: the member's
            // value is actually evicted from the store, and a subscriber on the
            // deleted member is notified. (Guards against the cross-scope commit
            // silently dropping deleteAtomFamilyAtoms / propagateDeletedAtoms.)
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "cd-fam" })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")
            const S = root.scope("S")
            const sAtom = atom(0, { name: "cd-s" })
            const m2cb = mock(() => {})
            root.sub(m2, m2cb)
            expect(root.data.values.has(m2)).toBe(true)

            root.txn(t => {
                t.del(m2)
                t.scope("S", st => st.set(sAtom, 9))
            })

            expect(root.data.values.has(m2)).toBe(false) // value evicted
            expect(m2cb).toHaveBeenCalledTimes(1) // deletion notified
        })

        test("delete at root + scope NEWLY shadows another atom, spanning selector", () => {
            // Combines the delete path with the newly-shadow hazard: a selector
            // spanning the family count and a scope atom that S shadows for the
            // first time in this txn. The selector must end at the fully-applied
            // state ("1:9") and fire exactly once — no half-applied "1:0" or
            // "2:9", and the new shadow must not get masked.
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "dn-fam" })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")

            const S = root.scope("S")
            const Y = atom(0, { name: "dn-y" })

            const span = selector(get => `${get(fam).length}:${get(Y)}`, {
                name: "dn-span",
            })
            const seen: string[] = []
            S.sub(span, () => seen.push(S.get(span)))
            expect(S.get(span)).toBe("2:0")

            root.txn(t => {
                t.del(m2)
                t.scope("S", st => st.set(Y, 9)) // first shadow of Y in S
            })

            expect(S.get(span)).toBe("1:9")
            expect(seen).toEqual(["1:9"])
        })
    })

    describe("family atoms in a scoped txn", () => {
        test("members added at root + scope are atomically observable", () => {
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "fam-scope" })
            const S = root.scope("S")

            const count = selector(get => get(fam).length, {
                name: "fam-count",
            })
            const seen: number[] = []
            S.sub(count, () => seen.push(S.get(count)))
            expect(S.get(count)).toBe(0)

            root.txn(t => {
                t.set(fam("r1"), "x")
                t.scope("S", st => st.set(fam("s1"), "y"))
            })

            // S sees the root-level member AND its own member in a single
            // notification — never just the root member (length 1) first.
            expect(seen).toEqual([2])
            expect(S.get(count)).toBe(2)
        })
    })

    describe("subscription re-rooting on a txn scope-shadow", () => {
        test("delegated direct subscription fires once when the scope shadows in the same txn", () => {
            // A direct atom subscription created in a scope before the scope
            // shadows the atom is registered both at the scope (a wrapped
            // callback) and, delegated, at root. When one txn both writes X at
            // root and shadows X in the scope, leaf-first notification runs the
            // scope's pass first; its wrapped callback drops the root delegate
            // before root's pass would fire it — so the subscriber fires once,
            // matching how the non-txn set() path re-roots.
            const root = store()
            const S = root.scope("S")
            const X = atom(0, { name: "rr-x" })
            const cb = mock(() => {})
            S.sub(X, cb) // delegated to root (S has not shadowed X yet)

            root.txn(t => {
                t.set(X, 5)
                t.scope("S", st => st.set(X, 5)) // S newly shadows X
            })

            expect(S.get(X)).toBe(5)
            expect(cb).toHaveBeenCalledTimes(1)

            // And the delegate is gone: a later root write must NOT notify S.
            root.set(X, 6)
            expect(cb).toHaveBeenCalledTimes(1)
            expect(S.get(X)).toBe(5) // S keeps its shadow
        })

        test("scope shadows with a value different from root's", () => {
            const root = store()
            const S = root.scope("S")
            const X = atom(0, { name: "rr-x2" })
            const cb = mock(() => {})
            S.sub(X, cb)

            root.txn(t => {
                t.set(X, 5)
                t.scope("S", st => st.set(X, 9))
            })

            expect(root.get(X)).toBe(5)
            expect(S.get(X)).toBe(9)
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("scope subscription still delegates when the scope does NOT shadow in the txn", () => {
            // If the scope never shadows X, the delegate must remain: a root
            // write in the txn still notifies the scope subscriber.
            const root = store()
            const S = root.scope("S")
            const X = atom(0, { name: "rr-x3" })
            const cb = mock(() => {})
            S.sub(X, cb)

            root.txn(t => {
                t.set(X, 5)
            })

            expect(S.get(X)).toBe(5) // inherited
            expect(cb).toHaveBeenCalledTimes(1)

            // Delegate intact — a second root write still notifies S.
            root.set(X, 6)
            expect(cb).toHaveBeenCalledTimes(2)
            expect(S.get(X)).toBe(6)
        })
    })

    describe("union-propagation: serializable single notification", () => {
        test("a root+scope spanning selector is notified once with the final value", () => {
            // The selector is reachable both via the root's propagateToScopes
            // and via the scope's own propagation pass. With no cross-pass dedup
            // guard it is recomputed in each reaching pass (the later pass
            // reading the now-final inputs), but notification is deferred to the
            // end of the commit — so the subscriber fires exactly once, with the
            // fully-applied value. (The body running once per pass is the cost
            // of dropping the dedup; the guarantee that matters is the single,
            // final-valued notification.)
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "dd-r" })
            const s = atom(10, { name: "dd-s" })
            S.set(s, 10)

            let evals = 0
            const sum = selector(
                get => {
                    evals++
                    return get(r) + get(s)
                },
                { name: "dd-sum" },
            )
            const cb = mock(() => {})
            S.sub(sum, cb)
            S.get(sum)
            const before = evals

            root.txn(t => {
                t.set(r, 2)
                t.scope("S", st => st.set(s, 20))
            })

            expect(S.get(sum)).toBe(22)
            expect(evals - before).toBe(2) // recomputed once per reaching pass
            expect(cb).toHaveBeenCalledTimes(1) // single, final-valued notification
        })

        test("deeper spanning chain: each selector is notified once with its final value", () => {
            // r (root) and s (scope) feed a → b. Both a and b span the two
            // stores; each is recomputed in both passes but observed once, final.
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "dd2-r" })
            const s = atom(10, { name: "dd2-s" })
            S.set(s, 10)

            let aEvals = 0
            let bEvals = 0
            const a = selector(
                get => {
                    aEvals++
                    return get(r) + get(s)
                },
                { name: "dd2-a" },
            )
            const b = selector(
                get => {
                    bEvals++
                    return get(a) + get(s)
                },
                { name: "dd2-b" },
            )
            S.sub(b, () => {})
            S.get(b)
            const aBefore = aEvals
            const bBefore = bEvals

            root.txn(t => {
                t.set(r, 2)
                t.scope("S", st => st.set(s, 20))
            })

            expect(S.get(a)).toBe(22)
            expect(S.get(b)).toBe(42)
            // Final values are correct; bodies recompute per reaching pass.
            expect(aEvals - aBefore).toBe(2)
            expect(bEvals - bBefore).toBe(2)
        })

        test("single-store update + delete: spanning selector is notified once with its final value", () => {
            // A selector depending on both an updated atom AND a deleted family
            // is reachable by the commit's update pass (propagateAtomUpdate) and
            // its delete pass (propagateDeletedAtoms). It recomputes in each, but
            // deferred notification fires its subscriber once, with the final
            // value.
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "ud-fam" })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")
            const Y = atom(0, { name: "ud-y" })

            let evals = 0
            const span = selector(
                get => {
                    evals++
                    return `${get(fam).length}:${get(Y)}`
                },
                { name: "ud-span" },
            )
            const cb = mock(() => {})
            root.sub(span, cb)
            root.get(span)
            const before = evals

            root.txn(t => {
                t.del(m2)
                t.set(Y, 9)
            })

            expect(root.get(span)).toBe("1:9")
            expect(evals - before).toBe(2) // recomputed in the update and delete passes
            expect(cb).toHaveBeenCalledTimes(1) // single, final-valued notification
        })

        test("cross-scope: scope selector spanning a root atom + a root-deleted family runs once", () => {
            // A selector in S depends on a root atom (updated) and a root family
            // (member deleted), with S NOT shadowing the family. Both reach S in
            // a single propagateToScopes pass, so the selector evaluates once and
            // ends at the fully-applied state.
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "cud-fam" })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")
            const R = atom(0, { name: "cud-r" })
            const S = root.scope("S")

            let evals = 0
            const span = selector(
                get => {
                    evals++
                    return `${get(fam).length}:${get(R)}`
                },
                { name: "cud-span" },
            )
            const cb = mock(() => {})
            S.sub(span, cb)
            S.get(span)
            const before = evals

            root.txn(t => {
                t.del(m2)
                t.set(R, 9)
            })

            expect(S.get(span)).toBe("1:9")
            expect(evals - before).toBe(1)
            expect(cb).toHaveBeenCalledTimes(1)
        })
    })

    // The dedup guard skips a selector once any pass has evaluated it. That is
    // only sound if the FIRST pass to reach a selector evaluates it against
    // final values. For a scope selector that transitively depends on an
    // ancestor atom THROUGH another scope selector, that requires the ancestor's
    // pass (which settles the intermediate scope selector via propagateToScopes)
    // to run before the scope's own pass — i.e. root-first notify. These pin
    // that ordering invariant directly, with plain selectors (no families), so a
    // regression to leaf-first notify is caught here rather than incidentally.
    describe("commit propagation order keeps transitive scope selectors fresh", () => {
        test("scope selector → scope selector → root atom, plus a scope atom, in one txn", () => {
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "ord-r" }) // root atom
            const Y = atom(0, { name: "ord-y" }) // scope atom
            S.set(Y, 0)

            // A (in S) depends on the root atom; B (in S) depends on A AND the
            // scope atom. Under leaf-first notify the scope's Y-pass would
            // evaluate B against a stale A (r not yet propagated into S) and the
            // guard would then skip B's correcting re-eval in the root pass.
            const A = selector(get => get(r), { name: "ord-A" })
            const B = selector(get => get(A) + get(Y), { name: "ord-B" })
            const cb = mock(() => {})
            S.sub(B, cb)
            expect(S.get(B)).toBe(1) // A=1, Y=0

            root.txn(t => {
                t.set(r, 5)
                t.scope("S", st => st.set(Y, 9))
            })

            expect(S.get(A)).toBe(5)
            expect(S.get(B)).toBe(14) // 5 + 9, never the stale 1 + 9 = 10
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("three-level transitive chain stays consistent", () => {
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "ord3-r" })
            const Y = atom(0, { name: "ord3-y" })
            S.set(Y, 0)

            const A = selector(get => get(r), { name: "ord3-A" })
            const Bsel = selector(get => get(A) * 2, { name: "ord3-B" })
            const C = selector(get => get(Bsel) + get(Y), { name: "ord3-C" })
            const cb = mock(() => {})
            S.sub(C, cb)
            expect(S.get(C)).toBe(2) // A=1 → B=2 → C=2+0

            root.txn(t => {
                t.set(r, 10)
                t.scope("S", st => st.set(Y, 3))
            })

            // A=10 → B=20 → C=20+3. Never a stale intermediate.
            expect(S.get(C)).toBe(23)
            expect(cb).toHaveBeenCalledTimes(1)
        })
    })

    // A txn that adds or deletes a root family member must cascade into a scope
    // that already shadows the family. Inside a txn, del()/set() clone a NEW
    // root family index that becomes the committed one; the shadowing scope's
    // index keeps a `parentIndex` pointer to the old object, so it must be
    // re-linked at commit (see recursivelyUpdateIndexes). Outside a txn the root
    // index is mutated in place, so this always worked there.
    describe("family add/delete in a txn cascades into a shadowing scope", () => {
        const buildShadowedFamily = (famName: string) => {
            const root = store()
            const fam = atomFamily<string>(undefined, { name: famName })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")
            const S = root.scope("S")
            S.set(fam("s-only"), "z") // S shadows the family (own index)
            const count = selector(get => get(fam).length, {
                name: `${famName}-count`,
            })
            const cb = mock(() => {})
            S.sub(count, cb)
            expect(S.get(count)).toBe(3) // m1, m2, s-only
            return { root, fam, m1, m2, S, count, cb }
        }

        test("txn delete of a root member drops the scope's count", () => {
            const { root, m2, S, count, cb } = buildShadowedFamily("fd-fam")
            root.txn(t => t.del(m2))
            expect(S.get(count)).toBe(2) // {m1, s-only}
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("txn add of a root member raises the scope's count", () => {
            const { root, fam, S, count, cb } = buildShadowedFamily("fa-fam")
            root.txn(t => t.set(fam("3"), "c"))
            expect(S.get(count)).toBe(4) // {m1, m2, s-only, 3}
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("cross-scope txn: root delete + scope write both observed", () => {
            const { root, m2, S, count, cb } = buildShadowedFamily("fc-fam")
            const Y = atom(0, { name: "fc-y" })
            S.set(Y, 0)
            const spanCb = mock(() => {})
            const span = selector(get => `${get(count)}:${get(Y)}`, {
                name: "fc-span",
            })
            S.sub(span, spanCb)
            expect(S.get(span)).toBe("3:0")

            root.txn(t => {
                t.del(m2)
                t.scope("S", st => st.set(Y, 9))
            })

            expect(S.get(count)).toBe(2)
            expect(S.get(span)).toBe("2:9")
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("non-txn root delete still cascades (unchanged behavior)", () => {
            const { root, m2, S, count } = buildShadowedFamily("fn-fam")
            root.del(m2)
            expect(S.get(count)).toBe(2)
        })
    })
})
