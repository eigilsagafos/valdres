import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import type { StoreChange } from "../types/StoreChange"
import { wait } from "../../test/utils/wait"

const waitFor = async (callback: () => void, count = 0, maxRetries = 200) => {
    try {
        callback()
        return
    } catch (e) {
        if (count >= maxRetries) {
            throw new Error(`waitFor timed out after ${maxRetries} retries`, {
                cause: e,
            })
        }
        await wait(1)
        return waitFor(callback, count + 1, maxRetries)
    }
}

describe("store.onChange", () => {
    test("fires on a direct set with the atom, new value and empty scope", () => {
        const store1 = store()
        const atom1 = atom(1)
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.set(atom1, 2)

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: atom1, value: 2, scope: [] },
        ])
        unsub()
    })

    test("does not fire when the value is unchanged", () => {
        const store1 = store()
        const atom1 = atom(1)
        const cb = mock()
        const unsub = store1.onChange(cb)

        store1.set(atom1, 1)

        expect(cb).not.toHaveBeenCalled()
        unsub()
    })

    test("fires on reset", () => {
        const store1 = store()
        const atom1 = atom(1)
        store1.set(atom1, 5)
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.reset(atom1)

        expect(calls).toEqual([
            [{ type: "atom", kind: "set", state: atom1, value: 1, scope: [] }],
        ])
        unsub()
    })

    test("a transaction emits a single callback with every changed atom", () => {
        const store1 = store()
        const atom1 = atom(1)
        const atom2 = atom("a")
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.txn(({ set }) => {
            set(atom1, 2)
            set(atom2, "b")
        })

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: atom1, value: 2, scope: [] },
            { type: "atom", kind: "set", state: atom2, value: "b", scope: [] },
        ])
        unsub()
    })

    test("a transaction does not report an unchanged atom", () => {
        const store1 = store()
        const atom1 = atom(1)
        const atom2 = atom(2)
        store1.get(atom1) // initialize so the unchanged set is a true no-op
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.txn(({ set }) => {
            set(atom1, 1) // unchanged
            set(atom2, 3)
        })

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: atom2, value: 3, scope: [] },
        ])
        unsub()
    })

    test("a transaction reports source 'transaction' and its name", () => {
        const store1 = store()
        const atom1 = atom(1)
        const metas: unknown[] = []
        const unsub = store1.onChange((_changes, meta) => metas.push(meta))

        store1.txn(({ set }) => set(atom1, 2), "rename-user")

        expect(metas).toEqual([{ source: "transaction", name: "rename-user" }])
        unsub()
    })

    test("a plain set reports source 'set' and no name", () => {
        const store1 = store()
        const atom1 = atom(1)
        let receivedMeta: any
        const unsub = store1.onChange((_changes, meta) => {
            receivedMeta = meta
        })

        store1.set(atom1, 2)

        expect(receivedMeta.source).toBe("set")
        expect(receivedMeta.name).toBeUndefined()
        unsub()
    })

    test("reset, delete and revalidation report their source", async () => {
        const store1 = store()
        const atom1 = atom(1)
        const family = atomFamily((id: string) => `default-${id}`)
        const familyAtom = family("x")
        store1.set(atom1, 5)
        store1.set(familyAtom, "v")
        const sources: string[] = []
        const unsub = store1.onChange((_c, meta) => sources.push(meta.source))

        store1.reset(atom1)
        store1.del(familyAtom)

        expect(sources).toEqual(["reset", "delete"])
        unsub()

        // maxAge revalidation reports source "revalidate".
        let fetchCount = 0
        const cached = atom(() => ++fetchCount, { maxAge: 10 })
        const revalidateSources: string[] = []
        const unsub2 = store1.onChange((_c, meta) =>
            revalidateSources.push(meta.source),
        )
        const unsubAtom = store1.sub(cached, () => {})
        store1.get(cached)
        await waitFor(() => expect(revalidateSources).toContain("revalidate"))
        unsubAtom()
        unsub2()
    })

    test("an async set resolution reports source 'async-set'", async () => {
        const store1 = store()
        const atom1 = atom(0)
        const metas: any[] = []
        const unsub = store1.onChange((_c, meta) => metas.push(meta))

        const promise = Promise.resolve(7)
        store1.set(atom1, promise) // immediate: source "set"
        await promise
        await Promise.resolve()

        expect(metas[0].source).toBe("set")
        expect(metas[metas.length - 1].source).toBe("async-set")
        unsub()
    })

    test("a global atom set in a txn: origin gets 'transaction', each peer gets a separate 'set' (peer fires first)", () => {
        const store1 = store()
        const store2 = store()
        const g = atom(0, { global: true })
        // Initialize in both stores (joining the global sync set) before
        // subscribing, so init-seeding doesn't muddy the assertions.
        store1.get(g)
        store2.get(g)

        const order: string[] = []
        const originMetas: any[] = []
        const peerMetas: any[] = []
        const unsub1 = store1.onChange((_c, meta) => {
            order.push("origin")
            originMetas.push(meta)
        })
        const unsub2 = store2.onChange((_c, meta) => {
            order.push("peer")
            peerMetas.push(meta)
        })

        store1.txn(({ set }) => set(g, 1), "bump")

        expect(originMetas).toEqual([{ source: "transaction", name: "bump" }])
        expect(peerMetas).toEqual([{ source: "set" }])
        expect(order).toEqual(["peer", "origin"]) // peer fires mid-commit, first
        unsub1()
        unsub2()
    })

    test("reports a previously-bypassing change: async default resolution", async () => {
        const store1 = store()
        const asyncAtom = atom(() => Promise.resolve(42))
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.get(asyncAtom) // triggers init; value is a pending promise
        await Promise.resolve()
        await Promise.resolve()

        const change = calls.flat().find(c => c.state === asyncAtom)
        expect(change).toMatchObject({ kind: "set", value: 42 })
        unsub()
    })

    test("reports maxAge revalidation of the real atom, but never the internal cacheMeta atom", async () => {
        const store1 = store()
        let fetchCount = 0
        const atom1 = atom(() => ++fetchCount, { maxAge: 10 })
        const changes: StoreChange[] = []
        const unsub = store1.onChange(cs => changes.push(...cs))
        // A direct subscriber mounts the atom and starts the maxAge timer.
        const unsubAtom = store1.sub(atom1, () => {})
        store1.get(atom1)

        // A revalidation tick re-runs the default (fetchCount increments) and
        // reports the refreshed value — the change that previously bypassed
        // onChange entirely.
        await waitFor(() => {
            const reported = changes.filter(c => c.state === atom1)
            expect(
                reported.some(
                    c =>
                        c.type === "atom" &&
                        c.kind === "set" &&
                        (c.value as number) >= 2,
                ),
            ).toBe(true)
        })

        // The cacheMeta atom updates on every tick but must never surface.
        expect(changes.some(c => c.state === (atom1 as any).__cacheMeta)).toBe(
            false,
        )
        expect(
            changes.some(c => (c.state as any).__valdresInternal === true),
        ).toBe(false)

        unsubAtom()
        unsub()
    })

    test("does not report internal (valdres-created) atoms", () => {
        const store1 = store()
        // Internal atoms (e.g. cacheMeta) propagate to subscribers but carry
        // __valdresInternal; onChange must skip them.
        const internalAtom = atom(0)
        ;(internalAtom as any).__valdresInternal = true
        const cb = mock()
        const unsub = store1.onChange(cb)

        store1.set(internalAtom, 1)

        expect(cb).not.toHaveBeenCalled()
        unsub()
    })

    test("unsubscribe stops further callbacks", () => {
        const store1 = store()
        const atom1 = atom(1)
        const cb = mock()
        const unsub = store1.onChange(cb)

        store1.set(atom1, 2)
        expect(cb).toHaveBeenCalledTimes(1)

        unsub()
        store1.set(atom1, 3)
        expect(cb).toHaveBeenCalledTimes(1)
    })

    test("supports multiple independent listeners", () => {
        const store1 = store()
        const atom1 = atom(1)
        const a = mock()
        const b = mock()
        const unsubA = store1.onChange(a)
        const unsubB = store1.onChange(b)

        store1.set(atom1, 2)

        expect(a).toHaveBeenCalledTimes(1)
        expect(b).toHaveBeenCalledTimes(1)
        unsubA()
        unsubB()
    })

    test("a change in a scope reports the scope path", () => {
        const root = store("root")
        const child = root.scope("child")
        const atom1 = atom("default")
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(changes => calls.push(changes))

        child.set(atom1, "scoped")

        expect(calls).toEqual([
            [
                {
                    type: "atom",
                    kind: "set",
                    state: atom1,
                    value: "scoped",
                    scope: ["child"],
                },
            ],
        ])
        unsub()
    })

    test("nested scopes report the full path, not just the leaf id", () => {
        const root = store("root")
        const child = root.scope("child")
        const nested = child.scope("nested")
        const atom1 = atom("default")
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(changes => calls.push(changes))

        root.set(atom1, "root-value")
        nested.set(atom1, "nested-value")

        expect(calls).toEqual([
            [
                {
                    type: "atom",
                    kind: "set",
                    state: atom1,
                    value: "root-value",
                    scope: [],
                },
            ],
            [
                {
                    type: "atom",
                    kind: "set",
                    state: atom1,
                    value: "nested-value",
                    scope: ["child", "nested"],
                },
            ],
        ])
        unsub()
    })

    test("a scope listener only sees changes in its own subtree", () => {
        const root = store("root")
        const childA = root.scope("a")
        const childB = root.scope("b")
        const atom1 = atom("default")
        const aCalls: (readonly StoreChange[])[] = []
        const unsub = childA.onChange(changes => aCalls.push(changes))

        root.set(atom1, "root") // above the scope — not seen
        childB.set(atom1, "b") // sibling — not seen
        childA.set(atom1, "a") // in the subtree — seen

        expect(aCalls).toEqual([
            [
                {
                    type: "atom",
                    kind: "set",
                    state: atom1,
                    value: "a",
                    scope: ["a"],
                },
            ],
        ])
        unsub()
    })

    test("a cross-scope transaction emits one callback tagged per scope", () => {
        const root = store("root")
        root.scope("child")
        const atom1 = atom(0)
        const atom2 = atom(0)
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(changes => calls.push(changes))

        root.txn(txn => {
            txn.set(atom1, 1)
            txn.scope("child", scoped => {
                scoped.set(atom2, 2)
            })
        })

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: atom1, value: 1, scope: [] },
            {
                type: "atom",
                kind: "set",
                state: atom2,
                value: 2,
                scope: ["child"],
            },
        ])
        unsub()
    })

    test("reports async atom resolution as a follow-up change", async () => {
        const store1 = store()
        const atom1 = atom(0)
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        const promise = Promise.resolve(42)
        store1.set(atom1, promise)

        // The pending set is reported immediately with the promise as value.
        expect(calls.length).toBe(1)
        expect(calls[0][0]).toMatchObject({
            kind: "set",
            state: atom1,
            value: promise,
        })

        await promise
        await Promise.resolve()

        // The resolution is reported as a separate change.
        expect(calls.length).toBe(2)
        expect(calls[1]).toEqual([
            { type: "atom", kind: "set", state: atom1, value: 42, scope: [] },
        ])
        unsub()
    })

    test("reports family atom changes", () => {
        const store1 = store()
        const family = atomFamily((id: string) => `default-${id}`)
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.set(family("x"), "custom")

        const familyAtom = family("x")
        const reported = calls.flat().find(c => c.state === familyAtom)
        expect(reported).toMatchObject({ kind: "set", value: "custom" })
        unsub()
    })

    test("reports a deletion via store.del", () => {
        const store1 = store()
        const family = atomFamily((id: string) => `default-${id}`)
        const familyAtom = family("x") // capture before del releases it
        store1.set(familyAtom, "custom")
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.del(familyAtom)

        expect(calls.length).toBe(1)
        const change = calls[0].find(c => c.state === familyAtom)
        expect(change).toEqual({
            type: "atom",
            kind: "delete",
            state: familyAtom,
            scope: [],
        })
        expect(change).not.toHaveProperty("value")
        unsub()
    })

    test("reports a deletion in a transaction, alongside value changes", () => {
        const store1 = store()
        const family = atomFamily((id: string) => `default-${id}`)
        const atom1 = atom(1)
        const familyAtom = family("x") // capture before del releases it
        store1.set(familyAtom, "custom")
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.txn(txn => {
            txn.set(atom1, 2)
            txn.del(familyAtom)
        })

        expect(calls.length).toBe(1)
        const valueChange = calls[0].find(c => c.state === atom1)
        expect(valueChange).toEqual({
            type: "atom",
            kind: "set",
            state: atom1,
            value: 2,
            scope: [],
        })
        const deletion = calls[0].find(
            c => c.type === "atom" && c.kind === "delete",
        )
        expect(deletion).toBeDefined()
        expect(deletion!.state).toBe(familyAtom)
        unsub()
    })

    test("an error in one listener does not stop the others", () => {
        const store1 = store()
        const atom1 = atom(1)
        const b = mock()
        const unsubA = store1.onChange(() => {
            throw new Error("boom")
        })
        const unsubB = store1.onChange(b)

        expect(() => store1.set(atom1, 2)).toThrow("boom")
        expect(b).toHaveBeenCalledTimes(1)
        unsubA()
        unsubB()
    })

    test("a listener that unsubscribes another store's listeners mid-dispatch does not crash", () => {
        // root + child scope both watched; a change in child buckets both
        // (child is dispatched first). The child listener tears down the root
        // listener, so the root bucket's listener set is already gone by the
        // time dispatch reaches it — must not throw.
        const root = store("root")
        const child = root.scope("child")
        const atom1 = atom("x")
        let rootUnsub = () => {}
        const childUnsub = child.onChange(() => {
            rootUnsub()
        })
        rootUnsub = root.onChange(() => {})

        expect(() => child.set(atom1, "y")).not.toThrow()
        childUnsub()
    })

    test("a throwing onChange listener does not mask a commit error", () => {
        // A cross-scope txn defers subscribers (notifyDeferred) until after the
        // onChange groups are buffered. If a subscriber throws AND an onChange
        // listener throws on flush, the original (subscriber) error must win —
        // the flush must not mask it.
        const root = store("root")
        root.scope("child")
        const atom1 = atom(1)
        const atom2 = atom(2)
        const unsubSub = root.sub(atom1, () => {
            throw new Error("subscriber boom")
        })
        const unsubChange = root.onChange(() => {
            throw new Error("onchange boom")
        })

        expect(() =>
            root.txn(t => {
                t.set(atom1, 9)
                t.scope("child", s => s.set(atom2, 9))
            }),
        ).toThrow("subscriber boom")

        unsubSub()
        unsubChange()
    })

    test("works in batchUpdates mode, batching a microtask of sets", async () => {
        const store1 = store({ batchUpdates: true })
        const atom1 = atom(1)
        const atom2 = atom(2)
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.set(atom1, 10)
        store1.set(atom2, 20)
        expect(calls.length).toBe(0)

        await Promise.resolve()

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: atom1, value: 10, scope: [] },
            { type: "atom", kind: "set", state: atom2, value: 20, scope: [] },
        ])
        unsub()
    })
})

describe("store.onChange — selectors", () => {
    test("reports a selector recompute when opted in, atom before selector", () => {
        const store1 = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const unsubSel = store1.sub(double, () => {}) // make the selector live
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        store1.set(a, 5)

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: a, value: 5, scope: [] },
            { type: "selector", state: double, value: 10, scope: [] },
        ])
        unsub()
        unsubSel()
    })

    test("does not report selectors to a listener that did not opt in", () => {
        const store1 = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const unsubSel = store1.sub(double, () => {})
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes)) // no opt-in

        store1.set(a, 5)

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: a, value: 5, scope: [] },
        ])
        unsub()
        unsubSel()
    })

    test("does not report a selector whose value did not change", () => {
        const store1 = store()
        const a = atom(1)
        const isEven = selector(get => get(a) % 2 === 0)
        const unsubSel = store1.sub(isEven, () => {})
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        store1.set(a, 3) // 1 → 3: both odd, isEven stays false

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: a, value: 3, scope: [] },
        ])
        unsub()
        unsubSel()
    })

    test("does not report a selector with no live consumer (orphaned)", () => {
        const store1 = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        store1.get(double) // registers the dependency, but no subscriber → not live
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        store1.set(a, 2)

        const all = calls.flat()
        expect(all.some(c => c.type === "selector")).toBe(false)
        expect(all.some(c => c.type === "atom" && c.state === a)).toBe(true)
        unsub()
    })

    test("reports chained selectors in dependency order, after the atom", () => {
        const store1 = store()
        const a = atom(1)
        const b = selector(get => get(a) * 2)
        const c = selector(get => get(b) + 1)
        const unsubSel = store1.sub(c, () => {}) // c live → b live (its dependency)
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        store1.set(a, 10)

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: a, value: 10, scope: [] },
            { type: "selector", state: b, value: 20, scope: [] },
            { type: "selector", state: c, value: 21, scope: [] },
        ])
        unsub()
        unsubSel()
    })

    test("a transaction batches atom and selector changes into one callback", () => {
        const store1 = store()
        const a = atom(1)
        const a2 = atom("x")
        const double = selector(get => get(a) * 2)
        const unsubSel = store1.sub(double, () => {})
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        store1.txn(({ set }) => {
            set(a, 5)
            set(a2, "y")
        })

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: a, value: 5, scope: [] },
            { type: "atom", kind: "set", state: a2, value: "y", scope: [] },
            { type: "selector", state: double, value: 10, scope: [] },
        ])
        unsub()
        unsubSel()
    })

    test("reports a scoped selector recompute with its scope path, exactly once", () => {
        const root = store("root")
        const child = root.scope("child")
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const unsubSel = child.sub(double, () => {}) // live in the child scope
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        root.set(a, 5)

        expect(calls.length).toBe(1)
        const atomChange = calls[0].find(c => c.type === "atom")
        expect(atomChange).toEqual({
            type: "atom",
            kind: "set",
            state: a,
            value: 5,
            scope: [],
        })
        const selChange = calls[0].find(c => c.type === "selector")
        expect(selChange).toEqual({
            type: "selector",
            state: double,
            value: 10,
            scope: ["child"],
        })
        unsub()
        unsubSel()
    })

    test("only listeners that opted in receive selector changes", () => {
        const store1 = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const unsubSel = store1.sub(double, () => {})
        const withSel: (readonly StoreChange[])[] = []
        const plain: (readonly StoreChange[])[] = []
        const u1 = store1.onChange(c => withSel.push(c), { selectors: true })
        const u2 = store1.onChange(c => plain.push(c))

        store1.set(a, 2)

        // opted-in listener sees both the atom and the selector
        expect(
            withSel.flat().some(c => c.type === "selector" && c.state === double),
        ).toBe(true)
        expect(withSel.flat().some(c => c.type === "atom" && c.state === a)).toBe(
            true,
        )
        // plain listener sees only the atom
        expect(plain.flat().some(c => c.type === "selector")).toBe(false)
        expect(plain.flat().some(c => c.type === "atom" && c.state === a)).toBe(
            true,
        )
        u1()
        u2()
        unsubSel()
    })

    test("{ atoms: false, selectors: true } delivers only selector changes", () => {
        const store1 = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const unsubSel = store1.sub(double, () => {})
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes), {
            atoms: false,
            selectors: true,
        })

        store1.set(a, 5)

        // the atom set is filtered out; only the derived recompute is delivered
        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "selector", state: double, value: 10, scope: [] },
        ])
        unsub()
        unsubSel()
    })

    test("{ atoms: false } listener does not fire for a pure atom change", () => {
        const store1 = store()
        const a = atom(1) // no dependent selector
        const cb = mock()
        const unsub = store1.onChange(cb, { atoms: false, selectors: true })

        store1.set(a, 2)

        expect(cb).not.toHaveBeenCalled()
        unsub()
    })

    test("an async selector resolving reports a type:selector change with source 'async-set'", async () => {
        const store1 = store()
        const asyncSel = selector(() => Promise.resolve(42))
        const calls: { changes: readonly StoreChange[]; meta: any }[] = []
        const unsub = store1.onChange(
            (changes, meta) => calls.push({ changes, meta }),
            { selectors: true },
        )
        const unsubSel = store1.sub(asyncSel, () => {}) // live + triggers eval

        await waitFor(() => {
            const c = calls
                .flatMap(x => x.changes)
                .find(c => c.type === "selector")
            expect(c).toBeDefined()
        })

        const entry = calls.find(x =>
            x.changes.some(c => c.type === "selector"),
        )!
        expect(entry.meta.source).toBe("async-set")
        const change = entry.changes.find(c => c.type === "selector")
        expect(change).toMatchObject({
            type: "selector",
            state: asyncSel,
            value: 42,
        })
        unsub()
        unsubSel()
    })

    test("reports a selector that recomputes from a family-atom deletion", () => {
        const store1 = store()
        const family = atomFamily((_id: string) => 0)
        const x = family("x")
        store1.set(x, 5)
        const double = selector(get => get(x) * 2)
        const unsubSel = store1.sub(double, () => {}) // live
        expect(store1.get(double)).toBe(10)
        const calls: (readonly StoreChange[])[] = []
        const unsub = store1.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        // del recomputes `double` (it reads the now-deleted member); the
        // recomputed value differs, so it's reported. This exercises the
        // delete-path selector reporting in propagateDeletedAtoms. (We don't
        // assert the recomputed value: reading a deleted family member is a
        // pre-existing valdres quirk, orthogonal to onChange.)
        store1.del(x)

        expect(calls.length).toBe(1)
        expect(
            calls[0].find(c => c.type === "atom" && c.kind === "delete"),
        ).toMatchObject({
            type: "atom",
            kind: "delete",
            state: x,
        })
        const sel = calls[0].find(c => c.type === "selector")
        expect(sel?.state).toBe(double)
        unsub()
        unsubSel()
    })

    test("reports a selector recompute two scope levels deep, with its full path", () => {
        const root = store("root")
        const child = root.scope("child")
        const grandchild = child.scope("grand")
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const unsubSel = grandchild.sub(double, () => {}) // live in the grandchild
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        root.set(a, 5)

        expect(calls.length).toBe(1)
        const sel = calls[0].find(c => c.type === "selector")
        expect(sel).toEqual({
            type: "selector",
            state: double,
            value: 10,
            scope: ["child", "grand"],
        })
        unsub()
        unsubSel()
    })

    test("a cross-scope change reports atoms before descendant-scope selectors (txn too)", () => {
        const root = store("root")
        const child = root.scope("child")
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const unsubSel = child.sub(double, () => {}) // live in the child scope
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(changes => calls.push(changes), {
            selectors: true,
        })

        // A transaction routes through a ChangeSink; the origin atom must still
        // precede the descendant-scope selector (matching the immediate path).
        root.txn(t => t.set(a, 5))

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { type: "atom", kind: "set", state: a, value: 5, scope: [] },
            { type: "selector", state: double, value: 10, scope: ["child"] },
        ])
        unsub()
        unsubSel()
    })

    test("an unset reports a dependent selector's recompute", () => {
        const s = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        s.set(a, 5) // a = 5 → double = 10
        s.sub(double, () => {}) // live
        expect(s.get(double)).toBe(10)
        const calls: (readonly StoreChange[])[] = []
        const unsub = s.onChange(c => calls.push(c), { selectors: true })

        s.unset(a) // a reverts to default 1 → double recomputes 10 → 2

        expect(calls.length).toBe(1)
        expect(calls[0].find(c => c.type === "atom")).toMatchObject({
            type: "atom",
            kind: "unset",
            state: a,
            value: 1,
        })
        const sel = calls[0].find(c => c.type === "selector")
        expect(sel).toEqual({
            type: "selector",
            state: double,
            value: 2,
            scope: [],
        })
        unsub()
    })

    test("an unset inside a transaction reports a dependent selector's recompute", () => {
        const s = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        s.set(a, 5)
        s.sub(double, () => {})
        const calls: { changes: readonly StoreChange[]; meta: any }[] = []
        const unsub = s.onChange((c, meta) => calls.push({ changes: c, meta }), {
            selectors: true,
        })

        s.txn(t => t.unset(a))

        expect(calls.length).toBe(1)
        expect(calls[0].meta.source).toBe("transaction")
        const sel = calls[0].changes.find(c => c.type === "selector")
        expect(sel).toEqual({
            type: "selector",
            state: double,
            value: 2,
            scope: [],
        })
        unsub()
    })

    test("an unset reports a descendant-scope selector recompute with its scope path", () => {
        const root = store("root")
        const child = root.scope("child")
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        root.set(a, 5)
        child.sub(double, () => {}) // double live in the child, reads inherited a
        expect(child.get(double)).toBe(10)
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(c => calls.push(c), { selectors: true })

        root.unset(a) // root a → default 1; child's double recomputes 10 → 2

        expect(calls.length).toBe(1)
        expect(calls[0].find(c => c.type === "atom")).toMatchObject({
            type: "atom",
            kind: "unset",
            state: a,
            value: 1,
            scope: [],
        })
        const sel = calls[0].find(c => c.type === "selector")
        expect(sel).toEqual({
            type: "selector",
            state: double,
            value: 2,
            scope: ["child"],
        })
        unsub()
    })

    test("an immediate del reports a descendant-scope selector recompute", () => {
        // Synergy with the immediate-del scope cascade (#181): root.del now
        // re-evaluates dependent selectors in descendant scopes, and selector
        // reporting threads through that cascade — so the scoped recompute is
        // reported, scope-tagged, in the same callback as the delete.
        const root = store("root")
        const child = root.scope("child")
        const fam = atomFamily((_id: string) => 0)
        const x = fam("x")
        root.set(x, 5)
        const sel = selector(get => get(x))
        child.sub(sel, () => {}) // live in the child, reads inherited x = 5
        expect(child.get(sel)).toBe(5)
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(c => calls.push(c), { selectors: true })

        root.del(x) // cascades to child; sel recomputes 5 → 0 (deleted → default)

        expect(calls.length).toBe(1)
        expect(
            calls[0].find(c => c.type === "atom" && c.kind === "delete"),
        ).toMatchObject({ type: "atom", kind: "delete", state: x, scope: [] })
        const sc = calls[0].find(c => c.type === "selector")
        expect(sc).toEqual({
            type: "selector",
            state: sel,
            value: 0,
            scope: ["child"],
        })
        unsub()
    })

    test("a multi-atom transaction reports a descendant-scope selector recompute", () => {
        // Guards the multi-atom no-shadow branch of propagateToScopes (distinct
        // from the single-atom fast path every other scope test exercises) — the
        // exact path where report threading was once silently dropped.
        const root = store("root")
        const child = root.scope("child")
        const a = atom(1)
        const b = atom(2)
        const sum = selector(get => get(a) + get(b))
        child.sub(sum, () => {}) // live in the child; reads inherited a, b → 3
        expect(child.get(sum)).toBe(3)
        const calls: (readonly StoreChange[])[] = []
        const unsub = root.onChange(c => calls.push(c), { selectors: true })

        root.txn(t => {
            t.set(a, 10)
            t.set(b, 20)
        })

        expect(calls.length).toBe(1)
        expect(calls[0].filter(c => c.type === "atom").length).toBe(2)
        const sc = calls[0].find(c => c.type === "selector")
        expect(sc).toEqual({
            type: "selector",
            state: sum,
            value: 30,
            scope: ["child"],
        })
        unsub()
    })

    // Compile-time contract: the callback's `changes` type follows the options.
    // These listeners never fire (immediately unsubscribed) — the value is the
    // type annotations below, which only mean something under a typecheck. NB:
    // this is NOT gated in CI — `build:types` compiles only `src/index.ts` (not
    // tests), and a repo-root `tsgo` carries many pre-existing errors. The
    // contract holds today (verified by local typecheck); keep these in sync if
    // the overloads change, and run `tsgo` on this file to re-verify.
    test("callback change type follows the options (compile-time)", () => {
        const s = store()
        // default → AtomChange[]: `kind` is reachable without narrowing on type
        s.onChange(changes => {
            for (const c of changes) {
                const kind: "set" | "unset" | "delete" = c.kind
                void kind
            }
        })()
        // { atoms: false, selectors: true } → SelectorChange[]: every entry is a selector
        s.onChange(
            changes => {
                for (const c of changes) {
                    const type: "selector" = c.type
                    void type
                }
            },
            { atoms: false, selectors: true },
        )()
        // { selectors: true } → StoreChange[]: discriminate on `type` first
        s.onChange(
            changes => {
                for (const c of changes) {
                    const type: "atom" | "selector" = c.type
                    void type
                }
            },
            { selectors: true },
        )()
        // { atoms: true, selectors: true } — the explicit "both" spelling — must
        // also resolve to StoreChange[] (regression guard for the overload that
        // previously rejected this literal).
        s.onChange(
            changes => {
                for (const c of changes) {
                    const type: "atom" | "selector" = c.type
                    void type
                }
            },
            { atoms: true, selectors: true },
        )()
        expect(true).toBe(true)
    })
})
