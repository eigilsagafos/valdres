import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// An ASYNC (Promise-returning) selector spanning a root atom and a scope atom,
// observed by a scope subscriber across a single cross-scope transaction.
//
// The cross-scope commit writes the whole tree, then runs ONE propagation pass
// per store (root-first), deferring all subscriber notification to commit-end
// (see propagateUpdatedAtoms.NotifyTarget / transaction.commit). The PR's
// "fires exactly once with the final value" guarantee is for SYNCHRONOUS
// selectors. A Promise-returning selector cannot honor that at commit time — its
// committed value IS a pending promise — so its observable contract is:
//
//   1 commit-end fire (delivering the pending promise) + 1 resolution fire
//   (delivering the resolved final value, from handleSelectorResult's .then,
//   a separate, later microtask outside the commit).
//
// These tests PIN that observed sequence exactly. Determinism comes from
// awaiting the selector's promise + a bounded microtask flush — no wall-clock
// timers.

// Flush a bounded number of microtask turns. handleSelectorResult chains a
// couple of .then() hops (promise resolve -> setValueInData -> propagate), so a
// handful of turns is enough; no setTimeout / real timers.
const flush = async (turns = 5) => {
    for (let i = 0; i < turns; i++) await Promise.resolve()
}

describe("async selector spanning root + scope under a cross-scope txn", () => {
    test("commit-end fire delivers a pending promise; resolution fire delivers the final value", async () => {
        const root = store()
        const S = root.scope("S")
        const r = atom(1, { name: "acs-r" })
        const s = atom(10, { name: "acs-s" })
        S.set(s, 10) // establish the scope-local shadow before the txn

        // Externally-controlled resolvers so resolution is a distinct, awaited
        // step (not racing the commit).
        const resolvers: Array<() => void> = []
        let evals = 0
        const sum = selector(
            get => {
                evals++
                const rv = get(r)
                const sv = get(s)
                return new Promise<number>(res => {
                    resolvers.push(() => res(rv + sv))
                })
            },
            { name: "acs-sum" },
        )

        // Record exactly what the scope subscriber observes on each fire.
        const observed: Array<number | "PROMISE"> = []
        const cb = mock(() => {
            const v = S.get(sum)
            observed.push(v instanceof Promise ? "PROMISE" : v)
        })

        // --- initial subscribe ---
        S.sub(sum, cb)
        // The value starts as a pending promise; the subscriber has NOT fired yet
        // (resolution is what notifies, and the promise is still pending).
        expect(S.get(sum)).toBeInstanceOf(Promise)
        expect(cb).toHaveBeenCalledTimes(0)
        expect(evals).toBe(1)

        // Resolve the initial promise; the subscriber fires once with 11.
        resolvers[resolvers.length - 1]()
        await flush()
        expect(observed).toEqual([11])
        expect(cb).toHaveBeenCalledTimes(1)
        expect(S.get(sum)).toBe(11)

        const evalsBeforeCommit = evals
        const resolversBeforeCommit = resolvers.length // 1
        const callsBeforeCommit = cb.mock.calls.length // 1

        // --- the cross-scope txn commit (synchronous, deferred notification) ---
        root.txn(t => {
            t.set(r, 2)
            t.scope("S", st => st.set(s, 20))
        })

        // CRUCIAL: the commit-end notification fires EXACTLY ONCE, even though
        // the async selector is reachable by two store-passes (root's
        // propagateToScopes + the scope's own pass). The deferred NotifyTarget
        // accumulates the subscriber into one per-store set and fires it once.
        expect(cb.mock.calls.length - callsBeforeCommit).toBe(1)

        // The selector BODY ran once per reaching pass (no cross-pass dedup for
        // promise selectors — the reference-equality check never prunes a fresh
        // promise), so two new promises were created during the commit. This is
        // the documented cost of dropping the dedup guard, not a notification
        // duplication.
        expect(evals - evalsBeforeCommit).toBe(2)
        expect(resolvers.length - resolversBeforeCommit).toBe(2)

        // What the single commit-end fire delivered: a PENDING PROMISE (the
        // committed value of an async selector mid-flight). NOT a stale numeric
        // intermediate, and NOT the final 22 (which isn't known yet).
        expect(observed).toEqual([11, "PROMISE"])
        expect(S.get(sum)).toBeInstanceOf(Promise)

        // --- the eventual promise RESOLUTION (separate, later microtask) ---
        // Resolve every promise created during the commit. Only the last-stored
        // one is the live value; handleSelectorResult's stale-promise guard
        // drops the others, so resolution notifies exactly once regardless.
        for (let i = resolversBeforeCommit; i < resolvers.length; i++) {
            resolvers[i]()
        }
        await flush()

        // Total commit-related fires = 2: the commit-end PROMISE fire + one
        // resolution fire carrying the correct final value 22 (r=2 + s=20).
        expect(cb.mock.calls.length - callsBeforeCommit).toBe(2)
        expect(observed).toEqual([11, "PROMISE", 22])
        expect(S.get(sum)).toBe(22)
    })

    test("resolution notifies exactly once and with the final value, whichever commit-promise resolves first", async () => {
        // The selector body runs twice during the commit, producing two promises
        // with identical inputs (r=2, s=20). Only the last-stored promise is the
        // live value. This pins that resolving them in REVERSE order still yields
        // exactly one resolution fire delivering 22 — the stale-promise guard
        // discards the non-live promise's resolution.
        const root = store()
        const S = root.scope("S")
        const r = atom(1, { name: "acs2-r" })
        const s = atom(10, { name: "acs2-s" })
        S.set(s, 10)

        const resolvers: Array<() => void> = []
        const sum = selector(
            get => {
                const rv = get(r)
                const sv = get(s)
                return new Promise<number>(res => {
                    resolvers.push(() => res(rv + sv))
                })
            },
            { name: "acs2-sum" },
        )
        const observed: Array<number | "PROMISE"> = []
        const cb = mock(() => {
            const v = S.get(sum)
            observed.push(v instanceof Promise ? "PROMISE" : v)
        })
        S.sub(sum, cb)
        resolvers[0]() // resolve initial
        await flush()
        expect(observed).toEqual([11])

        const resolversBeforeCommit = resolvers.length
        const callsBeforeCommit = cb.mock.calls.length

        root.txn(t => {
            t.set(r, 2)
            t.scope("S", st => st.set(s, 20))
        })
        expect(resolvers.length - resolversBeforeCommit).toBe(2)
        // one commit-end fire, delivering the pending promise
        expect(cb.mock.calls.length - callsBeforeCommit).toBe(1)
        expect(observed[observed.length - 1]).toBe("PROMISE")

        // Resolve REVERSE: last-created first, then the earlier (non-live) one.
        resolvers[resolvers.length - 1]()
        await flush()
        resolvers[resolversBeforeCommit]()
        await flush()

        // Exactly one resolution fire total (the second commit-promise's
        // resolution is dropped as stale), and the final value is 22.
        expect(cb.mock.calls.length - callsBeforeCommit).toBe(2)
        expect(observed).toEqual([11, "PROMISE", 22])
        expect(S.get(sum)).toBe(22)
    })

    test("deterministic via awaiting the committed promise (no controlled resolvers)", async () => {
        // Same contract, but the selector returns auto-resolving promises and the
        // test awaits the committed promise directly — proving the sequence is
        // observable without any manual resolver plumbing or real timers.
        const root = store()
        const S = root.scope("S")
        const r = atom(1, { name: "acs3-r" })
        const s = atom(10, { name: "acs3-s" })
        S.set(s, 10)

        const sum = selector(get => Promise.resolve(get(r) + get(s)), {
            name: "acs3-sum",
        })
        const observed: Array<number | "PROMISE"> = []
        const cb = mock(() => {
            const v = S.get(sum)
            observed.push(v instanceof Promise ? "PROMISE" : v)
        })
        S.sub(sum, cb)

        expect(await S.get(sum)).toBe(11)
        await flush()
        expect(observed).toEqual([11])

        const callsBeforeCommit = cb.mock.calls.length

        root.txn(t => {
            t.set(r, 2)
            t.scope("S", st => st.set(s, 20))
        })

        // Single commit-end fire delivering a pending promise.
        expect(cb.mock.calls.length - callsBeforeCommit).toBe(1)
        expect(observed).toEqual([11, "PROMISE"])

        // Await the committed promise; the resolution fire then lands.
        expect(await S.get(sum)).toBe(22)
        await flush()

        expect(cb.mock.calls.length - callsBeforeCommit).toBe(2)
        expect(observed).toEqual([11, "PROMISE", 22])
        expect(S.get(sum)).toBe(22)
    })
})
