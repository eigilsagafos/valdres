import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { selector } from "../selector"
import type { StoreChange } from "../types/StoreChange"

describe("scope.unset — re-inherit value", () => {
    test("unset drops the scope's own value so it re-inherits the parent", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        expect(scoped.get(a)).toBe(99)
        scoped.unset(a)
        expect(scoped.get(a)).toBe(10)
        // The parent is unaffected
        expect(root.get(a)).toBe(10)
    })

    test("after unset the scope tracks subsequent parent changes again", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)
        scoped.unset(a)

        root.set(a, 20)
        expect(scoped.get(a)).toBe(20)
        root.set(a, 30)
        expect(scoped.get(a)).toBe(30)
    })

    test("unset returns undefined", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        scoped.set(a, 2)
        expect(scoped.unset(a)).toBeUndefined()
    })
})

describe("scope.unset — bookkeeping cleanup", () => {
    test("parent scopeValueIndex no longer references the scope", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        scoped.set(a, 2)
        expect(root.data.scopeValueIndex.get(a)?.has(scoped.data)).toBe(true)

        scoped.unset(a)
        // The set is emptied and the key removed entirely.
        expect(root.data.scopeValueIndex.get(a)).toBeUndefined()
    })

    test("scope scopeIndexKeys no longer references the atom", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        scoped.set(a, 2)
        expect(scoped.data.scopeIndexKeys!.has(a)).toBe(true)

        scoped.unset(a)
        expect(scoped.data.scopeIndexKeys!.has(a)).toBe(false)
    })

    test("the scope's own value entry is removed from data.values", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        scoped.set(a, 2)
        expect(scoped.data.values.has(a)).toBe(true)

        scoped.unset(a)
        expect(scoped.data.values.has(a)).toBe(false)
    })

    test("unsetting one shadow leaves a sibling scope's shadow intact", () => {
        const root = store()
        const scopeA = root.scope("a")
        const scopeB = root.scope("b")
        const a = atom(1)
        scopeA.set(a, 100)
        scopeB.set(a, 200)

        scopeA.unset(a)
        // scopeValueIndex still references scopeB, not scopeA
        const set = root.data.scopeValueIndex.get(a)
        expect(set?.has(scopeA.data)).toBe(false)
        expect(set?.has(scopeB.data)).toBe(true)
        expect(scopeB.get(a)).toBe(200)
    })
})

describe("scope.unset — subscriber notification", () => {
    test("a subscriber added after the shadow fires on unset", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        const cb = mock(() => {})
        scoped.sub(a, cb)
        scoped.unset(a)
        expect(cb).toHaveBeenCalledTimes(1)
    })

    test("a subscriber added before the shadow fires on unset", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)

        const cb = mock(() => {})
        scoped.sub(a, cb)
        scoped.set(a, 99)
        expect(cb).toHaveBeenCalledTimes(1)

        scoped.unset(a)
        expect(cb).toHaveBeenCalledTimes(2)
    })

    test("a subscriber re-tracks parent changes after unset (subscribed before shadow)", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)

        const cb = mock(() => {})
        scoped.sub(a, cb)
        scoped.set(a, 99) // 1: shadow
        scoped.unset(a) // 2: re-inherit
        cb.mockClear()

        root.set(a, 20)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(scoped.get(a)).toBe(20)
    })

    test("a subscriber re-tracks parent changes after unset (subscribed after shadow)", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        const cb = mock(() => {})
        scoped.sub(a, cb)
        scoped.unset(a)
        cb.mockClear()

        root.set(a, 20)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(scoped.get(a)).toBe(20)
    })

    test("a subscriber does NOT fire twice when the scope re-shadows after unset", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        const cb = mock(() => {})
        scoped.sub(a, cb)
        scoped.unset(a)
        cb.mockClear()

        // Re-shadow: only the scope-local subscriber should fire (single fire)
        scoped.set(a, 55)
        expect(cb).toHaveBeenCalledTimes(1)
        // And the parent delegate must have been dropped: a parent change now
        // does not reach the (re-shadowing) scope.
        cb.mockClear()
        root.set(a, 77)
        expect(cb).toHaveBeenCalledTimes(0)
        expect(scoped.get(a)).toBe(55)
    })

    test("a dependent selector in the scope re-evaluates and notifies on unset", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        const doubled = selector(get => get(a) * 2)
        root.set(a, 10)
        scoped.set(a, 99)

        const cb = mock(() => {})
        scoped.sub(doubled, cb)
        expect(scoped.get(doubled)).toBe(198)

        scoped.unset(a)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(scoped.get(doubled)).toBe(20)
    })
})

describe("scope.unset — no-op semantics", () => {
    test("unsetting an un-shadowed atom is a no-op and does not notify", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)

        const cb = mock(() => {})
        scoped.sub(a, cb)
        scoped.unset(a) // scope never shadowed `a`
        expect(cb).toHaveBeenCalledTimes(0)
        expect(scoped.get(a)).toBe(10)
    })

    test("unsetting an un-shadowed atom does not emit onChange", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        const cb = mock(() => {})
        scoped.onChange(cb)
        scoped.unset(a)
        expect(cb).toHaveBeenCalledTimes(0)
    })
})

describe("unset — root store", () => {
    test("unset reverts the atom to its default", () => {
        const root = store()
        const a = atom(1)
        root.set(a, 5)
        expect(root.get(a)).toBe(5)

        root.unset(a)
        expect(root.get(a)).toBe(1)
    })

    test("unset removes the stored value (de-materializes)", () => {
        const root = store()
        const a = atom<object>({ d: true })
        root.set(a, { v: 1 })
        expect(root.data.values.has(a)).toBe(true)

        root.unset(a)
        expect(root.data.values.has(a)).toBe(false)
    })

    test("unset is a no-op when the atom has no stored value", () => {
        const root = store()
        const a = atom(1)
        const cb = mock(() => {})
        root.onChange(cb)
        root.unset(a) // never set or read
        expect(cb).toHaveBeenCalledTimes(0)
        expect(root.data.values.has(a)).toBe(false)
    })

    test("a subscriber fires on unset and onChange reports the default with source 'unset'", () => {
        const root = store()
        const a = atom(1)
        root.set(a, 5)

        const sub = mock(() => {})
        root.sub(a, sub)
        const calls: { changes: readonly StoreChange[]; meta: any }[] = []
        root.onChange((changes, meta) => calls.push({ changes, meta }))

        root.unset(a)

        expect(sub).toHaveBeenCalledTimes(1)
        expect(calls.length).toBe(1)
        expect(calls[0]!.meta.source).toBe("unset")
        expect(calls[0]!.changes).toEqual([
            { type: "atom", kind: "unset", state: a, value: 1, scope: [] },
        ])
        expect(root.get(a)).toBe(1)
    })

    test("a dependent selector re-evaluates after a root atom is unset", () => {
        const root = store()
        const a = atom(2)
        const doubled = selector(get => get(a) * 2)
        root.set(a, 5)

        const cb = mock(() => {})
        root.sub(doubled, cb)
        expect(root.get(doubled)).toBe(10)

        root.unset(a)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(root.get(doubled)).toBe(4) // default 2 * 2
    })

    test("unset in a transaction reverts a root atom to its default", () => {
        const root = store()
        const a = atom(1)
        root.set(a, 5)

        root.txn(t => t.unset(a))
        // De-materialized first (a read would re-initialize it), then reverts.
        expect(root.data.values.has(a)).toBe(false)
        expect(root.get(a)).toBe(1)
    })

    test("reading a root atom mid-transaction after unset returns the default", () => {
        const root = store()
        const a = atom(7)
        root.set(a, 5)

        let readInside: number | undefined
        root.txn(t => {
            t.unset(a)
            readInside = t.get(a) as number
        })
        expect(readInside).toBe(7)
    })

    test("a set after an unset in the same root transaction wins", () => {
        const root = store()
        const a = atom(1)
        root.set(a, 5)

        root.txn(t => {
            t.unset(a)
            t.set(a, 9)
        })
        expect(root.get(a)).toBe(9)
        expect(root.data.values.get(a)).toBe(9)
    })
})

describe("scope.unset — invalid input", () => {
    test("unsetting a selector throws", () => {
        const root = store()
        const scoped = root.scope("child")
        const sel = selector(() => 1)
        expect(() => scoped.unset(sel as any)).toThrow()
    })
})

describe("scope.unset — nested scopes", () => {
    test("inner scope inherits through an unset outer scope", () => {
        const root = store()
        const outer = root.scope("outer")
        const inner = outer.scope("inner")
        const a = atom(1)
        root.set(a, 10)
        outer.set(a, 50)

        // inner inherits from outer's shadow
        expect(inner.get(a)).toBe(50)

        outer.unset(a)
        // outer re-inherits root; inner (no own shadow) inherits through outer
        expect(outer.get(a)).toBe(10)
        expect(inner.get(a)).toBe(10)
    })

    test("unsetting the outer scope notifies an inner-scope selector subscriber", () => {
        const root = store()
        const outer = root.scope("outer")
        const inner = outer.scope("inner")
        const a = atom(1)
        const doubled = selector(get => get(a) * 2)
        root.set(a, 10)
        outer.set(a, 50)

        const cb = mock(() => {})
        inner.sub(doubled, cb)
        expect(inner.get(doubled)).toBe(100)

        outer.unset(a)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(inner.get(doubled)).toBe(20)
    })

    test("unsetting the inner scope re-inherits the outer scope's shadow", () => {
        const root = store()
        const outer = root.scope("outer")
        const inner = outer.scope("inner")
        const a = atom(1)
        root.set(a, 10)
        outer.set(a, 50)
        inner.set(a, 99)

        expect(inner.get(a)).toBe(99)
        inner.unset(a)
        expect(inner.get(a)).toBe(50) // inherits outer, not root
    })
})

describe("scope.unset — onChange", () => {
    test("emits an 'unset' change carrying the inherited value, source 'unset'", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        const calls: { changes: readonly StoreChange[]; meta: any }[] = []
        scoped.onChange((changes, meta) => calls.push({ changes, meta }))

        scoped.unset(a)

        expect(calls.length).toBe(1)
        expect(calls[0]!.meta.source).toBe("unset")
        expect(calls[0]!.changes).toEqual([
            { type: "atom", kind: "unset", state: a, value: 10, scope: ["child"] },
        ])
    })

    test("a root listener observes a descendant scope's unset with its scope path", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        const calls: { changes: readonly StoreChange[]; meta: any }[] = []
        root.onChange((changes, meta) => calls.push({ changes, meta }))

        scoped.unset(a)

        expect(calls.length).toBe(1)
        expect(calls[0]!.meta.source).toBe("unset")
        expect(calls[0]!.changes[0]).toEqual({
            type: "atom",
            kind: "unset",
            state: a,
            value: 10,
            scope: ["child"],
        })
    })

    test("the unset change uses kind 'unset', never 'set' or 'delete'", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        let received: readonly StoreChange[] = []
        scoped.onChange(changes => (received = changes))
        scoped.unset(a)
        expect(received[0]).toMatchObject({ type: "atom", kind: "unset" })
    })
})

describe("scope.unset — transaction form", () => {
    test("txn.scope(id, st => st.unset(atom)) re-inherits the parent", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        root.txn(t => {
            t.scope("child", st => st.unset(a))
        })

        expect(scoped.get(a)).toBe(10)
        expect(scoped.data.values.has(a)).toBe(false)
        expect(root.data.scopeValueIndex.get(a)).toBeUndefined()
    })

    test("an unset inside a txn reports kind 'unset' per-change (source stays 'transaction')", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        const b = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        const calls: { changes: readonly StoreChange[]; meta: any }[] = []
        scoped.onChange((changes, meta) => calls.push({ changes, meta }))

        // A mixed txn: a real set of `b` alongside an unset of `a`. The batch
        // source is "transaction", so the per-change kind is the only signal
        // that distinguishes the unset (drop the override) from the set.
        root.txn(t => {
            t.scope("child", st => {
                st.set(b, 5)
                st.unset(a)
            })
        })

        expect(calls.length).toBe(1)
        expect(calls[0]!.meta.source).toBe("transaction")
        const aChange = calls[0]!.changes.find(c => c.state === a)
        const bChange = calls[0]!.changes.find(c => c.state === b)
        expect(aChange).toEqual({
            type: "atom",
            kind: "unset",
            state: a,
            value: 10,
            scope: ["child"],
        })
        expect(bChange).toEqual({
            type: "atom",
            kind: "set",
            state: b,
            value: 5,
            scope: ["child"],
        })
    })

    test("a scoped subscriber fires once when a transaction unsets its shadow", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        const cb = mock(() => {})
        scoped.sub(a, cb)
        root.txn(t => {
            t.scope("child", st => st.unset(a))
        })
        expect(cb).toHaveBeenCalledTimes(1)
        expect(scoped.get(a)).toBe(10)
    })

    test("a set after an unset in the same txn wins (re-shadows)", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        root.txn(t => {
            t.scope("child", st => {
                st.unset(a)
                st.set(a, 5)
            })
        })
        // The later set must win — the atom is re-shadowed at 5, not re-inherited.
        expect(scoped.get(a)).toBe(5)
        expect(scoped.data.values.get(a)).toBe(5)
    })

    test("an unset after a set in the same txn wins (re-inherits)", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        root.txn(t => {
            t.scope("child", st => {
                st.set(a, 5)
                st.unset(a)
            })
        })
        expect(scoped.get(a)).toBe(10)
        expect(scoped.data.values.has(a)).toBe(false)
    })

    test("reading an unset atom mid-txn returns the inherited value, not the stale shadow", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        let readInside: number | undefined
        root.txn(t => {
            t.scope("child", st => {
                st.unset(a)
                readInside = st.get(a) as number
            })
        })
        expect(readInside).toBe(10)
    })

    test("a functional set after an unset uses the inherited value as its base", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        root.txn(t => {
            t.scope("child", st => {
                st.unset(a)
                st.set(a, prev => (prev as number) + 1) // base must be inherited 10
            })
        })
        expect(scoped.get(a)).toBe(11)
    })

    test("an inner scope reads through an unset outer scope mid-txn", () => {
        const root = store()
        const outer = root.scope("outer")
        const inner = outer.scope("inner")
        const a = atom(1)
        root.set(a, 10)
        outer.set(a, 50)

        let innerRead: number | undefined
        root.txn(t => {
            t.scope("outer", o => {
                o.unset(a)
                o.scope("inner", i => {
                    innerRead = i.get(a) as number
                })
            })
        })
        // inner has no own shadow; outer unset → both re-inherit root's 10
        expect(innerRead).toBe(10)
        expect(inner.get(a)).toBe(10)
    })

    test("a single-store scoped transaction reads an unset atom as inherited", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99)

        let readInside: number | undefined
        // scoped.txn → Transaction whose data is the scope itself, no parent txn
        scoped.txn(t => {
            t.unset(a)
            readInside = t.get(a) as number
        })
        expect(readInside).toBe(10)
        expect(scoped.get(a)).toBe(10)
    })
})

describe("scope.unset — notifies on value-equal shadow", () => {
    test("fires subscribers and onChange even when the inherited value equals the dropped shadow", () => {
        const root = store()
        const scoped = root.scope("child")
        const a = atom(1)
        root.set(a, 10)
        scoped.set(a, 99) // create a real shadow (differs from parent's 10)
        root.set(a, 99) // parent drifts to match — shadow now equals inherited
        expect(scoped.data.values.get(a)).toBe(99)

        const sub = mock(() => {})
        scoped.sub(a, sub)
        const onChange = mock(() => {})
        scoped.onChange(onChange)

        scoped.unset(a)

        // The override is dropped: the event must surface even though the
        // effective value is unchanged (matches reset's unconditional notify).
        expect(sub).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(scoped.data.values.has(a)).toBe(false)
    })
})
