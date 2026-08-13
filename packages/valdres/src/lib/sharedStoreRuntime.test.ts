import { getStoreData } from "./getStoreData"
import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

const nextMicrotask = () =>
    new Promise<void>(resolve => queueMicrotask(resolve))

describe("shared StoreData runtime", () => {
    test("scope consumers are leases over shared operations", () => {
        const root = store()
        expect(() => root.scope("missing", scope => scope.id)).toThrow(
            "valdres: scope 'missing' does not exist",
        )

        const first = root.scope("shared")
        const second = root.scope("shared")
        const scopedData = getStoreData(first)

        expect(first.get).toBe(second.get)
        expect(first.set).toBe(second.set)
        expect(first.scope).toBe(second.scope)
        expect(first.detach).not.toBe(second.detach)
        expect(scopedData.scopeConsumers?.size).toBe(2)

        first.detach()
        expect(scopedData.scopeConsumers?.size).toBe(1)
        expect(root.scope("shared", scope => scope.id)).toBe("shared")

        second.detach()
        expect(scopedData.scopeConsumers?.size).toBe(0)
        expect(getStoreData(root).scopes.has("shared")).toBe(false)
        expect(() => root.scope("shared", scope => scope.id)).toThrow(
            "valdres: scope 'shared' does not exist",
        )
        expect(() => second.get(atom(0))).toThrow(/disposed/i)
    })

    test("scope leases compose functional updates in one pending transaction", async () => {
        const root = store({ batchUpdates: true })
        const first = root.scope("shared")
        const second = root.scope("shared")
        const count = atom(0)

        first.set(count, current => current + 1)
        second.set(count, current => current + 1)

        expect(first.get(count)).toBe(2)
        expect(second.get(count)).toBe(2)

        await nextMicrotask()

        expect(getStoreData(first).values.get(count)).toBe(2)
    })

    test("a synchronous operation through another lease flushes the shared transaction", async () => {
        const root = store({ batchUpdates: true })
        const first = root.scope("shared")
        const second = root.scope("shared")
        const count = atom(0)

        first.set(count, 1)
        second.reset(count)

        await nextMicrotask()

        expect(first.get(count)).toBe(0)
    })

    test("scope leases coalesce subscriber notifications", async () => {
        const root = store({ batchUpdates: true })
        const first = root.scope("shared")
        const second = root.scope("shared")
        const left = atom(0)
        const right = atom(0)
        const total = selector(get => get(left) + get(right))
        const callback = mock(() => {})

        first.sub(total, callback)
        first.set(left, 1)
        second.set(right, 1)

        expect(callback).toHaveBeenCalledTimes(0)

        await nextMicrotask()

        expect(callback).toHaveBeenCalledTimes(1)
        expect(first.get(total)).toBe(2)
    })

    test("nested lease reads keep cold caches out of the live graph", () => {
        const root = store()
        const first = root.scope("shared")
        const second = root.scope("shared")
        const left = atom(1)
        const right = atom(2)
        const inner = selector(get => get(right))
        const outer = selector(get => get(left) + second.get(inner))

        expect(first.get(outer)).toBe(3)

        // Both handles share initialization coordination. Cold selectors now
        // remain revision-validated forward caches, so init propagation keeps
        // both values without promoting either dependency into the live graph.
        expect(getStoreData(first).values.has(outer)).toBe(true)
        expect(getStoreData(first).values.has(inner)).toBe(true)
        expect(
            getStoreData(first).stateDependents.get(left)?.has(outer) ?? false,
        ).toBe(false)
        expect(
            getStoreData(first).stateDependents.get(right)?.has(inner) ?? false,
        ).toBe(false)
    })

    test("the facade created for onMount shares pending writes", async () => {
        const root = store({ batchUpdates: true })
        const count = atom(0)
        const mounted = atom(0)
        mounted.onMount = mountedStore => {
            mountedStore.set(count, current => current + 1)
        }

        root.set(count, current => current + 1)
        const unsubscribe = root.sub(mounted, () => {})

        await nextMicrotask()

        expect(root.get(count)).toBe(2)
        unsubscribe()
    })
})
