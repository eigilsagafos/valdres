import { describe, test, expect, mock } from "bun:test"
import { atom, selector, store } from "valdres"

describe("batchUpdates with scoped stores", () => {
    test("scoped store inherits batchUpdates from parent", () => {
        const parentStore = store({ batchUpdates: true })
        const scopedStore = parentStore.scope("child")

        expect(scopedStore.data.batchUpdates).toBe(true)
    })

    test("scoped store batches set calls like parent", () => {
        const atomA = atom(0)
        const atomB = atom(0)
        const parentStore = store({ batchUpdates: true })
        const scopedStore = parentStore.scope("child")

        // Sequential sets should be readable together
        scopedStore.set(atomA, 1)
        scopedStore.set(atomB, 2)

        expect(scopedStore.get(atomA)).toBe(1)
        expect(scopedStore.get(atomB)).toBe(2)

        // Selector should see final state [1, 2], not intermediate
        const derived = selector(get => get(atomA) + get(atomB))
        expect(scopedStore.get(derived)).toBe(3)
    })

    test("scoped store subscriber notified once after microtask", async () => {
        const atomA = atom(0)
        const atomB = atom(0)
        const parentStore = store({ batchUpdates: true })
        const scopedStore = parentStore.scope("child")

        const derived = selector(get => get(atomA) + get(atomB))
        // Initialize and subscribe
        scopedStore.get(derived)
        const callback = mock(() => {})
        scopedStore.sub(derived, callback)

        scopedStore.set(atomA, 1)
        scopedStore.set(atomB, 2)

        // Subscriber not called yet (deferred to microtask)
        expect(callback).toHaveBeenCalledTimes(0)

        // After microtask, subscriber is notified
        await new Promise(resolve => queueMicrotask(resolve))
        expect(callback).toHaveBeenCalledTimes(1)
    })
})
