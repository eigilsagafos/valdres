import { getStoreData } from "./getStoreData"
import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { globalAtom } from "../globalAtom"
import { selector } from "../selector"
import { store } from "../store"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { uniqueName } from "../../test/utils/uniqueName"

describe("store.onCommitEnd", () => {
    test("plain set: fires exactly once, strictly after subscribers and onChange", () => {
        const store1 = store()
        const a = atom(0)
        const events: string[] = []
        store1.sub(a, () => events.push("subscriber"))
        const unsubChange = store1.onChange(() => events.push("onChange"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 1)
        expect(events).toEqual(["subscriber", "onChange", "commit-end"])
        unsub()
        unsubChange()
    })

    test("each standalone set is its own commit", () => {
        const store1 = store()
        const a = atom(0)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.set(a, 1)
        store1.set(a, 2)
        expect(fired).toHaveBeenCalledTimes(2)
        unsub()
    })

    test("a no-op set (equal value) does not commit, so it does not fire", () => {
        const store1 = store()
        const a = atom(1)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.set(a, 1)
        expect(fired).toHaveBeenCalledTimes(0)
        unsub()
    })

    test("store.txn: multi-atom commit fires once, after all subscribers", () => {
        const store1 = store()
        const a = atom(0)
        const b = atom(0)
        const events: string[] = []
        store1.sub(a, () => events.push("sub-a"))
        store1.sub(b, () => events.push("sub-b"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.txn(txn => {
            txn.set(a, 1)
            txn.set(b, 2)
        })
        expect(events.filter(e => e === "commit-end")).toHaveLength(1)
        expect(events[events.length - 1]).toBe("commit-end")
        expect(events).toContain("sub-a")
        expect(events).toContain("sub-b")
        unsub()
    })

    test("large fresh-only txn still fires without an onChange listener", () => {
        const store1 = store()
        const atoms = Array.from({ length: 256 }, () => atom(0))
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)

        store1.txn(txn => {
            for (const atom of atoms) txn.set(atom, 1)
        })

        expect(fired).toHaveBeenCalledTimes(1)
        unsub()
    })

    test("txn with family writes and a delete fires once", () => {
        const fam = atomFamily<number, [string]>(0)
        const store1 = store()
        store1.set(fam("x"), 1)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.txn(txn => {
            txn.set(fam("y"), 2)
            txn.del(fam("x"))
        })
        expect(fired).toHaveBeenCalledTimes(1)
        unsub()
    })

    test("batched store: one microtask flush is one commit", async () => {
        const store1 = store({ batchUpdates: true })
        const a = atom(0)
        const b = atom(0)
        const events: string[] = []
        store1.sub(a, () => events.push("sub-a"))
        store1.sub(b, () => events.push("sub-b"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 1)
        store1.set(b, 2)
        expect(events).toEqual([]) // nothing until the microtask flush
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(events.filter(e => e === "commit-end")).toHaveLength(1)
        expect(events[events.length - 1]).toBe("commit-end")
        unsub()
    })

    test("reset, unset, and del each fire once", () => {
        const store1 = store()
        const a = atom(0)
        const fam = atomFamily<number, [string]>(0)
        store1.set(a, 1)
        store1.set(fam("k"), 1)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.reset(a)
        expect(fired).toHaveBeenCalledTimes(1)
        store1.set(a, 2)
        expect(fired).toHaveBeenCalledTimes(2)
        store1.unset(a)
        expect(fired).toHaveBeenCalledTimes(3)
        store1.del(fam("k"))
        expect(fired).toHaveBeenCalledTimes(4)
        unsub()
    })

    test("a no-op txn (every write value-equal) does not commit, so it does not fire", () => {
        const store1 = store()
        const a = atom(1)
        const b = atom(2)
        store1.get(a)
        store1.get(b)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.txn(txn => {
            txn.set(a, 1)
            txn.set(b, 2)
        })
        expect(fired).toHaveBeenCalledTimes(0)
        unsub()
    })

    test("a no-op reset (already at the default) does not fire", () => {
        const store1 = store()
        const a = atom(1)
        store1.get(a)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.reset(a)
        expect(fired).toHaveBeenCalledTimes(0)
        store1.set(a, 2)
        store1.reset(a)
        expect(fired).toHaveBeenCalledTimes(2)
        unsub()
    })

    // The boundary of a commit whose write phase runs inside it is opened
    // before its emptiness is known, so these pin the two halves of the answer
    // it reports on close.
    test("a hooked txn that changes something still fires exactly once", () => {
        const store1 = store()
        const hooked = atom(0, { onSet: () => {} })
        const plain = atom(0)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.txn(txn => {
            txn.set(hooked, 1)
            txn.set(plain, 1)
        })
        expect(fired).toHaveBeenCalledTimes(1)
        unsub()
    })

    test("a commit whose subscriber throws still fires — the writes landed", () => {
        const store1 = store()
        const a = atom(0)
        const fired = mock(() => {})
        store1.sub(a, () => {
            throw new Error("subscriber boom")
        })
        const unsub = store1.onCommitEnd(fired)
        expect(() => store1.txn(txn => txn.set(a, 1))).toThrow(
            "subscriber boom",
        )
        expect(store1.get(a)).toBe(1)
        expect(fired).toHaveBeenCalledTimes(1)
        unsub()
    })

    test("a no-op outer commit still fires once for work a nested commit does", () => {
        const store1 = store()
        const trigger = atom(0)
        const nested = atom(0)
        const events: string[] = []
        let cascaded = false
        // The hook runs inside the outer commit; its write is the only work.
        const hooked = atom(0, {
            onSet: () => {
                if (cascaded) return
                cascaded = true
                store1.set(nested, 99)
            },
        })
        store1.sub(nested, () => events.push("sub-nested"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.txn(txn => {
            txn.set(hooked, 1)
            txn.set(trigger, 0) // value-equal, contributes nothing
        })
        expect(store1.get(nested)).toBe(99)
        expect(events).toEqual(["sub-nested", "commit-end"])
        unsub()
    })

    test("unset with no own value is a no-op and does not fire", () => {
        const store1 = store()
        const a = atom(0)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.unset(a)
        expect(fired).toHaveBeenCalledTimes(0)
        unsub()
    })

    test("writes performed by subscribers coalesce into the outer commit's single fire", () => {
        const store1 = store()
        const a = atom(0)
        const b = atom(0)
        const events: string[] = []
        let cascaded = false
        store1.sub(a, () => {
            events.push("sub-a")
            if (!cascaded) {
                cascaded = true
                store1.set(b, 99) // nested write during the commit
            }
        })
        store1.sub(b, () => events.push("sub-b"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 1)
        expect(events).toEqual(["sub-a", "sub-b", "commit-end"])
        expect(store1.get(b)).toBe(99)
        unsub()
    })

    // Scope delegation semantics, pinned: listeners live on the store TREE
    // (attached to its root), and any commit in the tree fires them.
    describe("scoped stores", () => {
        test("a root-registered listener fires for a scope-local write", () => {
            const root = store()
            const scoped = root.scope("ce-s1")
            const a = atom(0)
            const fired = mock(() => {})
            const unsub = root.onCommitEnd(fired)
            scoped.set(a, 1)
            expect(fired).toHaveBeenCalledTimes(1)
            unsub()
            scoped.detach()
        })

        test("a scope-registered listener fires for a root write", () => {
            const root = store()
            const scoped = root.scope("ce-s2")
            const a = atom(0)
            const fired = mock(() => {})
            const unsub = scoped.onCommitEnd(fired)
            root.set(a, 1)
            expect(fired).toHaveBeenCalledTimes(1)
            unsub()
            scoped.detach()
        })

        test("a cross-scope txn is one commit, fired after subscribers in both stores", () => {
            const root = store()
            const scoped = root.scope("ce-s3")
            const a = atom(0)
            const b = atom(0)
            scoped.set(b, 0) // shadow b in the scope
            const events: string[] = []
            root.sub(a, () => events.push("sub-root"))
            scoped.sub(b, () => events.push("sub-scope"))
            const unsubRoot = root.onCommitEnd(() => events.push("end-root"))
            const unsubScoped = scoped.onCommitEnd(() =>
                events.push("end-scope"),
            )
            root.txn(txn => {
                txn.set(a, 1)
                txn.scope("ce-s3", scopedTxn => scopedTxn.set(b, 2))
            })
            // both subscribers first, then each listener exactly once
            expect(events.slice(0, 2).sort()).toEqual(["sub-root", "sub-scope"])
            expect(events.slice(2).sort()).toEqual(["end-root", "end-scope"])
            unsubRoot()
            unsubScoped()
            scoped.detach()
        })

        test("a scoped global write opens one boundary for the store tree", () => {
            const root = store()
            const scoped = root.scope("ce-global")
            const value = globalAtom(0, { name: uniqueName("value") })
            const subscriberDepths: number[] = []
            root.get(value)
            const unsubValue = scoped.sub(value, () => {
                subscriberDepths.push(getStoreData(root).tree.commitDepth)
            })
            const unsubCommit = root.onCommitEnd(() => {})

            scoped.set(value, 1)

            expect(subscriberDepths).toEqual([1])
            expect(getStoreData(root).tree.commitDepth).toBe(0)
            unsubValue()
            unsubCommit()
            scoped.detach()
        })

        test("an unrelated root store's commit does not fire this tree's listeners", () => {
            const store1 = store()
            const store2 = store()
            const a = atom(0)
            const fired = mock(() => {})
            const unsub = store1.onCommitEnd(fired)
            store2.set(a, 1)
            expect(fired).toHaveBeenCalledTimes(0)
            unsub()
        })
    })

    test("unsubscribe stops firing; other listeners keep firing", () => {
        const store1 = store()
        const a = atom(0)
        const first = mock(() => {})
        const second = mock(() => {})
        const unsubFirst = store1.onCommitEnd(first)
        const unsubSecond = store1.onCommitEnd(second)
        store1.set(a, 1)
        unsubFirst()
        store1.set(a, 2)
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(2)
        unsubFirst() // double-unsubscribe is a no-op
        store1.set(a, 3)
        expect(second).toHaveBeenCalledTimes(3)
        unsubSecond()
    })

    test("fires even when a subscriber throws; the subscriber error still propagates", () => {
        const store1 = store()
        const a = atom(0)
        const fired = mock(() => {})
        store1.sub(a, () => {
            throw new Error("subscriber boom")
        })
        const unsub = store1.onCommitEnd(fired)
        expect(() => store1.set(a, 1)).toThrow("subscriber boom")
        expect(fired).toHaveBeenCalledTimes(1)
        expect(store1.get(a)).toBe(1) // the write was applied
        unsub()
    })

    test("a throwing listener surfaces its error without starving other listeners", () => {
        const store1 = store()
        const a = atom(0)
        const second = mock(() => {})
        const unsubThrowing = store1.onCommitEnd(() => {
            throw new Error("listener boom")
        })
        const unsubSecond = store1.onCommitEnd(second)
        expect(() => store1.set(a, 1)).toThrow("listener boom")
        expect(second).toHaveBeenCalledTimes(1)
        unsubThrowing()
        unsubSecond()
    })

    test("selector subscribers also precede the commit-end fire", () => {
        const store1 = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const events: string[] = []
        store1.sub(double, () => events.push("sub-selector"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 2)
        expect(events).toEqual(["sub-selector", "commit-end"])
        unsub()
    })

    test("async selector settlement is one commit after subscribers and onChange", async () => {
        const store1 = store()
        let resolve!: (value: number) => void
        const asyncValue = selector(
            () => new Promise<number>(r => (resolve = r)),
        )
        const events: string[] = []
        const subscriberDepths: number[] = []
        const unsubSelector = store1.sub(asyncValue, () => {
            events.push("subscriber")
            subscriberDepths.push(getStoreData(store1).tree.commitDepth)
        })
        const unsubChange = store1.onChange(() => events.push("onChange"), {
            atoms: false,
            selectors: true,
        })
        const unsubCommit = store1.onCommitEnd(() => events.push("commit-end"))

        resolve(42)
        await Promise.resolve()

        expect(events).toEqual(["subscriber", "onChange", "commit-end"])
        expect(subscriberDepths).toEqual([1])
        expect(store1.get(asyncValue)).toBe(42)
        unsubSelector()
        unsubChange()
        unsubCommit()
    })

    test("async selector observer errors are not handled as source-Promise rejection", () => {
        const store1 = store()
        let fulfill!: (value: number) => unknown
        let rejectSource: ((error: unknown) => unknown) | undefined
        let rejectChained: ((error: unknown) => unknown) | undefined
        const chainedPromise = {
            catch: (onRejected: (error: unknown) => unknown) => {
                rejectChained = onRejected
                return chainedPromise
            },
        }
        const sourcePromise = {
            then: (
                onFulfilled: (value: number) => unknown,
                onRejected?: (error: unknown) => unknown,
            ) => {
                fulfill = onFulfilled
                rejectSource = onRejected
                return chainedPromise
            },
        } as unknown as Promise<number>
        const asyncValue = selector(() => sourcePromise)
        const observerError = new Error("observer boom")
        const unsub = store1.sub(asyncValue, () => {
            throw observerError
        })
        let surfaced: unknown

        try {
            try {
                fulfill(42)
            } catch (error) {
                // Model Promise reaction routing without creating an actual
                // process-level unhandled rejection in the test runner.
                if (rejectChained) rejectChained(error)
                else surfaced = error
            }

            expect(rejectSource).toBeDefined()
            expect(rejectChained).toBeUndefined()
            expect(surfaced).toBe(observerError)
            expect(store1.get(asyncValue)).toBe(42)
        } finally {
            unsub()
        }
    })

    describe("boundary balance under settlement failure", () => {
        /** Force the cross-scope/global settlement's collection phase to throw.
         *  That phase runs before any user code and has no error accumulator, so
         *  it is the sharpest probe for "is every opened boundary closed". */
        const poisonDependents = (data: StoreData, state: State) => {
            data.stateDependents.set(state, {
                size: 1,
                [Symbol.iterator]() {
                    throw new Error("settlement boom")
                },
            })
            return () => data.stateDependents.delete(state)
        }

        test("a throwing forest settlement closes the boundary and still delivers", () => {
            const store1 = store()
            const value = globalAtom(0, { name: uniqueName("value") })
            const fired: string[] = []
            // Initialize before registering: the first read of a global atom is
            // itself a commit.
            store1.get(value)
            const unsub = store1.onCommitEnd(() => fired.push("commit-end"))
            const data = getStoreData(store1)
            const restore = poisonDependents(data, value)

            expect(() => store1.set(value, 1)).toThrow("settlement boom")
            // The depth counter must return to zero immediately: a stranded
            // depth silences onCommitEnd on this tree for the whole process.
            expect(data.tree.commitDepth).toBe(0)
            // Writes were applied, so the boundary still reports (same contract
            // as the throwing-subscriber case above).
            expect(fired).toEqual(["commit-end"])

            restore()
            store1.set(value, 2)
            expect(fired).toEqual(["commit-end", "commit-end"])
            unsub()
        })

        test("a multi-root forest closes every tree when the first listener throws", () => {
            const store1 = store()
            const store2 = store()
            const value = globalAtom(0, { name: uniqueName("value") })
            const second = mock(() => {})
            // Initialize before registering: the first read of a global atom is
            // itself a commit.
            store1.get(value)
            store2.get(value)
            const unsubFirst = store1.onCommitEnd(() => {
                throw new Error("listener boom")
            })
            const unsubSecond = store2.onCommitEnd(second)

            expect(() => store1.set(value, 1)).toThrow("listener boom")
            // A listener that throws must not strand the roots closed after it.
            expect(second).toHaveBeenCalledTimes(1)
            expect(getStoreData(store1).tree.commitDepth).toBe(0)
            expect(getStoreData(store2).tree.commitDepth).toBe(0)

            unsubFirst()
            unsubSecond()
        })
    })
})
