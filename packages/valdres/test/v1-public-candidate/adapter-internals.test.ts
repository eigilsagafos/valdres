import { describe, expect, test } from "bun:test"
import {
    assertStore,
    read,
    readHydrationSnapshot,
    subscribe,
} from "../../src/adapter-internals/v1"
import * as adapterApi from "../../src/adapter-internals/v1"
import {
    RuntimeMismatchError,
    atom,
    selector,
    store,
    type Store,
} from "../../src/index"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"

describe("v1 adapter internals", () => {
    test("exports exactly the four reviewed standalone operations", () => {
        expect(Object.keys(adapterApi).sort()).toEqual(
            [
                "assertStore",
                "read",
                "readHydrationSnapshot",
                "subscribe",
            ].sort(),
        )
    })

    test("recognizes root Stores through the same module-local domain", () => {
        const count = atom(0)
        const target = store()
        let narrowed: unknown = target

        assertStore(narrowed)
        const exact: Store = narrowed
        expect(read(exact, count)).toBe(0)

        let calls = 0
        const unsubscribe = subscribe(exact, count, () => calls++)
        exact.set(count, 1)
        expect(calls).toBe(1)
        unsubscribe()
        unsubscribe()
        exact.set(count, 2)
        expect(calls).toBe(1)
    })

    test("rejects foreign Stores before reads, subscriptions, or hydration", () => {
        const foreign = createCommittedStoreTreeDomain()
        const foreignStore = foreign.createStoreTree()
        let foreignInitializerCalls = 0
        const foreignState = foreign.atomLazy(() => {
            foreignInitializerCalls++
            return 1
        })
        const localStore = store()
        const count = atom(0)
        let callbacks = 0

        expect(() => assertStore(foreignStore)).toThrow(RuntimeMismatchError)
        expect(() => read(foreignStore, count)).toThrow(RuntimeMismatchError)
        expect(() => subscribe(foreignStore, count, () => callbacks++)).toThrow(
            RuntimeMismatchError,
        )
        expect(() => readHydrationSnapshot(foreignStore, count)).toThrow(
            RuntimeMismatchError,
        )
        expect(() => read(localStore, foreignState)).toThrow(
            RuntimeMismatchError,
        )
        expect(() =>
            subscribe(localStore, foreignState, () => callbacks++),
        ).toThrow(RuntimeMismatchError)
        expect(() => readHydrationSnapshot(localStore, foreignState)).toThrow(
            RuntimeMismatchError,
        )
        expect(callbacks).toBe(0)
        expect(foreignInitializerCalls).toBe(0)
    })

    test("isolates hydration selector evaluation from the live graph", () => {
        const source = atom.lazy(() => {
            initializerCalls++
            return 2
        })
        let initializerCalls = 0
        let selectorCalls = 0
        let comparatorCalls = 0
        const doubled = selector(
            get => {
                selectorCalls++
                return { value: get(source) * 2 }
            },
            {
                equal: (previous, next) => {
                    comparatorCalls++
                    return previous.value === next.value
                },
            },
        )
        const target = store()

        expect(readHydrationSnapshot(target, doubled)).toEqual({ value: 4 })
        expect(readHydrationSnapshot(target, doubled)).toEqual({ value: 4 })
        expect(initializerCalls).toBe(1)
        expect(selectorCalls).toBe(2)
        expect(comparatorCalls).toBe(0)

        expect(read(target, doubled)).toEqual({ value: 4 })
        expect(read(target, doubled)).toBe(read(target, doubled))
        expect(selectorCalls).toBe(3)
        expect(comparatorCalls).toBe(0)

        expect(readHydrationSnapshot(target, doubled)).toEqual({ value: 4 })
        expect(selectorCalls).toBe(4)
        expect(comparatorCalls).toBe(0)
    })
})
