import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
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
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.set(atom1, 2)

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([{ atom: atom1, value: 2, scope: [] }])
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
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.reset(atom1)

        expect(calls).toEqual([[{ atom: atom1, value: 1, scope: [] }]])
        unsub()
    })

    test("a transaction emits a single callback with every changed atom", () => {
        const store1 = store()
        const atom1 = atom(1)
        const atom2 = atom("a")
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.txn(({ set }) => {
            set(atom1, 2)
            set(atom2, "b")
        })

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { atom: atom1, value: 2, scope: [] },
            { atom: atom2, value: "b", scope: [] },
        ])
        unsub()
    })

    test("a transaction does not report an unchanged atom", () => {
        const store1 = store()
        const atom1 = atom(1)
        const atom2 = atom(2)
        store1.get(atom1) // initialize so the unchanged set is a true no-op
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.txn(({ set }) => {
            set(atom1, 1) // unchanged
            set(atom2, 3)
        })

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([{ atom: atom2, value: 3, scope: [] }])
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

    test("reports a previously-bypassing change: async default resolution", async () => {
        const store1 = store()
        const asyncAtom = atom(() => Promise.resolve(42))
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.get(asyncAtom) // triggers init; value is a pending promise
        await Promise.resolve()
        await Promise.resolve()

        const change = calls.flat().find(c => c.atom === asyncAtom)
        expect(change).toBeDefined()
        expect(change!.value).toBe(42)
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
            const reported = changes.filter(c => c.atom === atom1)
            expect(reported.some(c => (c.value as number) >= 2)).toBe(true)
        })

        // The cacheMeta atom updates on every tick but must never surface.
        expect(changes.some(c => c.atom === (atom1 as any).__cacheMeta)).toBe(
            false,
        )
        expect(
            changes.some(c => (c.atom as any).__valdresInternal === true),
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
        const calls: StoreChange[][] = []
        const unsub = root.onChange(changes => calls.push(changes))

        child.set(atom1, "scoped")

        expect(calls).toEqual([
            [{ atom: atom1, value: "scoped", scope: ["child"] }],
        ])
        unsub()
    })

    test("nested scopes report the full path, not just the leaf id", () => {
        const root = store("root")
        const child = root.scope("child")
        const nested = child.scope("nested")
        const atom1 = atom("default")
        const calls: StoreChange[][] = []
        const unsub = root.onChange(changes => calls.push(changes))

        root.set(atom1, "root-value")
        nested.set(atom1, "nested-value")

        expect(calls).toEqual([
            [{ atom: atom1, value: "root-value", scope: [] }],
            [{ atom: atom1, value: "nested-value", scope: ["child", "nested"] }],
        ])
        unsub()
    })

    test("a scope listener only sees changes in its own subtree", () => {
        const root = store("root")
        const childA = root.scope("a")
        const childB = root.scope("b")
        const atom1 = atom("default")
        const aCalls: StoreChange[][] = []
        const unsub = childA.onChange(changes => aCalls.push(changes))

        root.set(atom1, "root") // above the scope — not seen
        childB.set(atom1, "b") // sibling — not seen
        childA.set(atom1, "a") // in the subtree — seen

        expect(aCalls).toEqual([[{ atom: atom1, value: "a", scope: ["a"] }]])
        unsub()
    })

    test("a cross-scope transaction emits one callback tagged per scope", () => {
        const root = store("root")
        root.scope("child")
        const atom1 = atom(0)
        const atom2 = atom(0)
        const calls: StoreChange[][] = []
        const unsub = root.onChange(changes => calls.push(changes))

        root.txn(txn => {
            txn.set(atom1, 1)
            txn.scope("child", scoped => {
                scoped.set(atom2, 2)
            })
        })

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { atom: atom1, value: 1, scope: [] },
            { atom: atom2, value: 2, scope: ["child"] },
        ])
        unsub()
    })

    test("reports async atom resolution as a follow-up change", async () => {
        const store1 = store()
        const atom1 = atom(0)
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        const promise = Promise.resolve(42)
        store1.set(atom1, promise)

        // The pending set is reported immediately with the promise as value.
        expect(calls.length).toBe(1)
        expect(calls[0][0].atom).toBe(atom1)
        expect(calls[0][0].value).toBe(promise)

        await promise
        await Promise.resolve()

        // The resolution is reported as a separate change.
        expect(calls.length).toBe(2)
        expect(calls[1]).toEqual([{ atom: atom1, value: 42, scope: [] }])
        unsub()
    })

    test("reports family atom changes", () => {
        const store1 = store()
        const family = atomFamily((id: string) => `default-${id}`)
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.set(family("x"), "custom")

        const familyAtom = family("x")
        const reported = calls.flat().find(c => c.atom === familyAtom)
        expect(reported).toBeDefined()
        expect(reported!.value).toBe("custom")
        unsub()
    })

    test("reports a deletion via store.del", () => {
        const store1 = store()
        const family = atomFamily((id: string) => `default-${id}`)
        const familyAtom = family("x") // capture before del releases it
        store1.set(familyAtom, "custom")
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.del(familyAtom)

        expect(calls.length).toBe(1)
        const change = calls[0].find(c => c.atom === familyAtom)
        expect(change).toBeDefined()
        expect(change!.deleted).toBe(true)
        expect(change!.value).toBeUndefined()
        unsub()
    })

    test("reports a deletion in a transaction, alongside value changes", () => {
        const store1 = store()
        const family = atomFamily((id: string) => `default-${id}`)
        const atom1 = atom(1)
        const familyAtom = family("x") // capture before del releases it
        store1.set(familyAtom, "custom")
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.txn(txn => {
            txn.set(atom1, 2)
            txn.del(familyAtom)
        })

        expect(calls.length).toBe(1)
        const valueChange = calls[0].find(c => c.atom === atom1)
        expect(valueChange).toEqual({ atom: atom1, value: 2, scope: [] })
        const deletion = calls[0].find(c => c.deleted)
        expect(deletion).toBeDefined()
        expect(deletion!.atom).toBe(familyAtom)
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

    test("works in batchUpdates mode, batching a microtask of sets", async () => {
        const store1 = store({ batchUpdates: true })
        const atom1 = atom(1)
        const atom2 = atom(2)
        const calls: StoreChange[][] = []
        const unsub = store1.onChange(changes => calls.push(changes))

        store1.set(atom1, 10)
        store1.set(atom2, 20)
        expect(calls.length).toBe(0)

        await Promise.resolve()

        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual([
            { atom: atom1, value: 10, scope: [] },
            { atom: atom2, value: 20, scope: [] },
        ])
        unsub()
    })
})
