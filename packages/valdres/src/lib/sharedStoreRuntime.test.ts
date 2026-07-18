import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

const nextMicrotask = () =>
    new Promise<void>(resolve => queueMicrotask(resolve))

describe("shared StoreData runtime", () => {
    test("scope consumers are leases over shared operations", () => {
        const root = store()
        const first = root.scope("shared")
        const second = root.scope("shared")

        expect(first.get).toBe(second.get)
        expect(first.set).toBe(second.set)
        expect(first.scope).toBe(second.scope)
        expect(first.detach).not.toBe(second.detach)
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

        expect(first.data.values.get(count)).toBe(2)
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

    test("nested lease reads share initialization coordination", () => {
        const root = store()
        const first = root.scope("shared")
        const second = root.scope("shared")
        const left = atom(1)
        const right = atom(2)
        const inner = selector(get => get(right))
        const outer = selector(get => get(left) + second.get(inner))

        expect(first.get(outer)).toBe(3)

        // Init-only propagation keeps the public read target cached, but leaves
        // another selector reached during the same initialization invalidated
        // for lazy re-evaluation. The nested handle must not flush the shared
        // init set before `outer` finishes installing its dependency edges.
        expect(first.data.values.has(outer)).toBe(true)
        expect(first.data.values.has(inner)).toBe(false)
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
