import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

const nextMicrotask = () =>
    new Promise<void>(resolve => queueMicrotask(resolve))

describe("batched cross-scope reads", () => {
    test("a child synchronously sees a pending root write", () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const value = atom(0)

        root.set(value, 1)

        expect(child.get(value)).toBe(1)
    })

    test("a root read stays isolated from a pending child shadow", () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const value = atom(0)

        child.set(value, 1)

        expect(child.get(value)).toBe(1)
        expect(root.get(value)).toBe(0)
    })

    test("a derived child write uses the pending root value", () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const source = atom(0)
        const derived = atom(0)

        root.set(source, 1)
        child.set(derived, child.get(source) + 1)

        expect(child.get(derived)).toBe(2)
    })

    test("a child selector combines a pending root value with its own shadow", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const inherited = atom(0)
        const shadowed = atom(0)
        const total = selector(get => get(inherited) + get(shadowed))

        child.set(shadowed, 10)
        await nextMicrotask()

        root.set(inherited, 1)

        expect(child.get(total)).toBe(11)
    })

    test("an inherited read stays fresh when the child writes first", () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const inherited = atom(0)
        const shadowed = atom(0)

        child.set(shadowed, 10)
        root.set(inherited, 1)

        expect(child.get(inherited)).toBe(1)
        expect(child.get(shadowed)).toBe(10)
    })

    test("a grandchild sees a pending root write without creating a shadow", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const grandchild = child.scope("grandchild")
        const value = atom(0)

        root.set(value, 1)
        expect(grandchild.get(value)).toBe(1)

        await nextMicrotask()
        root.set(value, 2)
        await nextMicrotask()

        expect(grandchild.get(value)).toBe(2)
    })

    test("linked root and child writes remain fresh after the batch commits", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const value = atom(0)

        root.set(value, 1)
        child.set(value, current => current + 1)

        expect(root.get(value)).toBe(1)
        expect(child.get(value)).toBe(2)

        await nextMicrotask()

        expect(root.get(value)).toBe(1)
        expect(child.get(value)).toBe(2)
    })

    test("a subscriber can read the child while the linked batch is committing", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const inherited = atom(0)
        const shadowed = atom(0)
        const total = selector(get => get(inherited) + get(shadowed))
        const observed: number[] = []

        child.sub(total, () => observed.push(child.get(total)))
        root.set(inherited, 1)
        child.set(shadowed, 2)

        await nextMicrotask()

        expect(observed).toEqual([3])
    })

    test("disposing a writing child preserves the root write", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const rootValue = atom("initial")
        const childValue = atom(0)

        root.set(rootValue, "saved")
        child.set(childValue, 1)
        child.dispose()

        await nextMicrotask()

        expect(root.get(rootValue)).toBe("saved")
    })

    test("disposing one writing sibling preserves another sibling's write", async () => {
        const root = store({ batchUpdates: true })
        const first = root.scope("first")
        const second = root.scope("second")
        const value = atom(0)

        first.set(value, 1)
        second.set(value, 2)
        first.dispose()

        await nextMicrotask()

        expect(second.get(value)).toBe(2)
        expect(root.get(value)).toBe(0)
    })

    test("disposing a read-only child preserves the root write", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const value = atom(0)

        root.set(value, 1)
        expect(child.get(value)).toBe(1)
        child.dispose()

        await nextMicrotask()

        expect(root.get(value)).toBe(1)
    })

    test("disposing a grandchild preserves ancestor writes", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const grandchild = child.scope("grandchild")
        const rootValue = atom(0)
        const childValue = atom(0)

        root.set(rootValue, 1)
        child.set(childValue, 2)
        expect(grandchild.get(rootValue)).toBe(1)
        grandchild.dispose()

        await nextMicrotask()

        expect(root.get(rootValue)).toBe(1)
        expect(child.get(childValue)).toBe(2)
    })

    test("an explicit child transaction flushes the pending ancestor batch", () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const source = atom(0)
        const derived = atom(0)

        root.set(source, 1)
        child.txn(txn => txn.set(derived, txn.get(source) + 1))

        expect(child.get(derived)).toBe(2)
    })

    test("a child reset flushes the pending ancestor batch first", () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const source = atom(0)
        const local = atom(0)
        let notifications = 0
        root.sub(source, () => notifications++)

        root.set(source, 1)
        expect(notifications).toBe(0)
        child.reset(local)

        expect(notifications).toBe(1)
        expect(root.get(source)).toBe(1)
    })

    test("non-batched cross-scope read-after-write stays synchronous", () => {
        const root = store()
        const child = root.scope("child")
        const source = atom(0)
        const derived = atom(0)

        root.set(source, 1)
        expect(child.get(source)).toBe(1)

        child.set(derived, child.get(source) + 1)
        expect(child.get(derived)).toBe(2)
        expect(root.get(derived)).toBe(0)
    })
})
