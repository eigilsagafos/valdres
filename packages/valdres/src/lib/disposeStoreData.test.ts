import { describe, expect, mock, spyOn, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { StoreDisposedError } from "../errors/StoreDisposedError"
import { mockAsyncSource, withFakeClock } from "../../test/utils/fakeClock"
import { cacheState } from "./cacheState"
import { getStoreData } from "./getStoreData"
import { commitEndRegistry } from "./onCommitEnd"
import { changeListenerRegistry } from "./notifyChangeListeners"
import { assertStoreInvariants } from "../../test/invariants/checkStoreInvariants"

const settle = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve()
}

describe("store.dispose", () => {
    test("drains ordinary subscriptions, mounts, and maxAge timers", () => {
        const clearIntervalSpy = spyOn(globalThis, "clearInterval")
        try {
            const cleanup = mock(() => {})
            const target = atom(0, {
                maxAge: 1_000,
                onMount: () => cleanup,
            })
            const targetStore = store()
            const unsubscribe = targetStore.sub(target, () => {})
            const clearsBeforeDispose = clearIntervalSpy.mock.calls.length

            expect(
                getStoreData(targetStore).subscriptions.get(target)?.size,
            ).toBe(1)
            targetStore.dispose()

            expect(cleanup).toHaveBeenCalledTimes(1)
            expect(clearIntervalSpy.mock.calls.length).toBe(
                clearsBeforeDispose + 1,
            )
            expect(
                getStoreData(targetStore).subscriptions.get(target),
            ).toBeUndefined()
            // The disposed store must be terminal: no retained resources,
            // subscriptions, mounts, or listeners anywhere in the tree.
            assertStoreInvariants(targetStore)

            // Disposers handed out before terminal disposal stay idempotent.
            unsubscribe()
            expect(cleanup).toHaveBeenCalledTimes(1)
        } finally {
            clearIntervalSpy.mockRestore()
        }
    })

    test("disposal cancels cache revalidation and rejects late publication", () =>
        withFakeClock(async clock => {
            const clearIntervalSpy = spyOn(globalThis, "clearInterval")
            const clearTimeoutSpy = spyOn(globalThis, "clearTimeout")
            try {
                const maxAge = atom(20)
                const source = mockAsyncSource<number>()
                const cached = atom(source.fn, {
                    maxAge,
                    staleWhileRevalidate: 50,
                })
                const targetStore = store()
                const callback = mock(() => {})
                const unsubscribe = targetStore.sub(cached, callback)
                const data = getStoreData(targetStore)

                await source.resolve(1)
                await clock.advance(20)
                expect(source.callCount).toBe(2)
                const callsBeforeDispose = callback.mock.calls.length
                const intervalsBeforeDispose =
                    clearIntervalSpy.mock.calls.length
                const timeoutsBeforeDispose = clearTimeoutSpy.mock.calls.length

                targetStore.dispose()

                expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(
                    intervalsBeforeDispose,
                )
                expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(
                    timeoutsBeforeDispose,
                )
                expect(cacheState.peek(cached, data)?.release).toBeUndefined()
                assertStoreInvariants(targetStore, { states: [cached, maxAge] })

                await source.resolve(2, 1)
                await clock.advance(100)
                expect(data.values.get(cached)).toBe(1)
                expect(callback).toHaveBeenCalledTimes(callsBeforeDispose)
                expect(source.callCount).toBe(2)

                unsubscribe()
            } finally {
                clearIntervalSpy.mockRestore()
                clearTimeoutSpy.mockRestore()
            }
        }))

    test("drains every subscription after active-state churn", () => {
        const targetStore = store()
        const first = atom(0)
        const second = atom(0)
        const third = atom(0)
        const unsubscribeFirst = targetStore.sub(first, () => {})
        const unsubscribeSecondA = targetStore.sub(second, () => {})
        const unsubscribeSecondB = targetStore.sub(second, () => {})
        const unsubscribeThird = targetStore.sub(third, () => {}, false)

        expect(
            getStoreData(targetStore).subscriptionsRequireEqualCheck.has(third),
        ).toBe(true)

        // Remove one active-state key while a second still has multiple
        // subscriptions and a third has opted out of structural equality.
        unsubscribeFirst()
        targetStore.dispose()

        expect(
            getStoreData(targetStore).subscriptions.get(first),
        ).toBeUndefined()
        expect(
            getStoreData(targetStore).subscriptions.get(second),
        ).toBeUndefined()
        expect(
            getStoreData(targetStore).subscriptions.get(third),
        ).toBeUndefined()

        unsubscribeSecondA()
        unsubscribeSecondB()
        unsubscribeThird()
    })

    test("hands a shared global maxAge timer to a live store", () =>
        withFakeClock(async clock => {
            const owner = store()
            const survivor = store()
            const maxAge = atom(30)
            let fetchCount = 0
            const target = atom(() => ++fetchCount, {
                global: true,
                maxAge,
            })

            owner.sub(target, () => {})
            survivor.sub(target, () => {})
            owner.dispose()

            survivor.set(maxAge, 5_000)
            const countAfterHandoff = fetchCount
            await clock.advance(100)

            expect(fetchCount).toBe(countAfterHandoff)
            expect(target.cacheController?.refCount).toBe(1)

            survivor.dispose()
            expect(target.cacheController).toBeUndefined()
        }))

    test("a disposed mount cannot mutate a global atom in a live store", () => {
        const liveStore = store()
        const requestStore = store()
        const shared = atom(0, { global: true })
        liveStore.get(shared)

        let tick!: () => void
        const cleanup = mock(() => {})
        const source = atom(0, {
            onMount: mountedStore => {
                tick = () => mountedStore.set(shared, 1)
                return cleanup
            },
        })
        requestStore.sub(source, () => {})

        requestStore.dispose()

        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(() => tick()).toThrow(/disposed/i)
        expect(liveStore.get(shared)).toBe(0)
    })

    test("detaching a scope removes its delegated subscriptions", () => {
        const root = store()
        const scoped = root.scope("request")
        const target = atom(0)
        const callback = mock(() => {})
        const unsubscribe = scoped.sub(target, callback)

        scoped.detach()
        root.set(target, 1)

        expect(callback).not.toHaveBeenCalled()
        expect(() => scoped.get(target)).toThrow(/disposed/i)
        unsubscribe()
    })

    test("balances onChange and onCommitEnd registries for the whole tree", () => {
        const changeCount = changeListenerRegistry.count
        const selectorCount = changeListenerRegistry.selectorCount
        const commitEndCount = commitEndRegistry.count
        const root = store()
        const child = root.scope("child")

        const cleanups = [
            root.onChange(() => {}),
            child.onChange(() => {}, { selectors: true }),
            root.onCommitEnd(() => {}),
            child.onCommitEnd(() => {}),
        ]

        expect(changeListenerRegistry.count).toBe(changeCount + 2)
        expect(changeListenerRegistry.selectorCount).toBe(selectorCount + 1)
        expect(commitEndRegistry.count).toBe(commitEndCount + 2)
        // Both registrations land on the ONE tree-owned set, whichever store
        // they were made through.
        expect(getStoreData(root).tree.commitEndListeners?.size).toBe(2)
        expect(getStoreData(child).tree).toBe(getStoreData(root).tree)

        root.dispose()

        expect(changeListenerRegistry.count).toBe(changeCount)
        expect(changeListenerRegistry.selectorCount).toBe(selectorCount)
        expect(commitEndRegistry.count).toBe(commitEndCount)
        expect(getStoreData(root).tree.commitEndListeners).toBeUndefined()
        // The whole disposed tree (root + child scope) must be terminal.
        assertStoreInvariants(root)
        for (const cleanup of cleanups) cleanup()
        expect(changeListenerRegistry.count).toBe(changeCount)
        expect(changeListenerRegistry.selectorCount).toBe(selectorCount)
        expect(commitEndRegistry.count).toBe(commitEndCount)
    })

    test("aborts selector work and ignores pending atom initialization", async () => {
        const targetStore = store()
        let resolveAtom!: (value: number) => void
        const pendingAtom = new Promise<number>(resolve => {
            resolveAtom = resolve
        })
        const asyncAtom = atom(() => pendingAtom)
        const atomSubscriber = mock(() => {})
        targetStore.sub(asyncAtom, atomSubscriber)

        let signal!: AbortSignal
        let resolveSelector!: (value: number) => void
        const pendingSelector = new Promise<number>(resolve => {
            resolveSelector = resolve
        })
        const asyncSelector = selector((_get, options) => {
            signal = options.signal
            return pendingSelector
        })
        targetStore.get(asyncSelector)

        targetStore.dispose()

        expect(signal.aborted).toBe(true)
        resolveAtom(1)
        resolveSelector(1)
        await settle()
        // Terminal after async settlement: aborted controllers, drained
        // resources, and no re-registration from the late resolutions.
        assertStoreInvariants(targetStore)
        expect(atomSubscriber).not.toHaveBeenCalled()
        expect(getStoreData(targetStore).values.get(asyncAtom)).toBe(
            pendingAtom,
        )
        expect(getStoreData(targetStore).values.get(asyncSelector)).toBe(
            pendingSelector,
        )
    })

    test("cancels speculative selector work in a queued batch", async () => {
        const targetStore = store({ batchUpdates: true })
        const source = atom(0)
        let signal!: AbortSignal
        const pending = new Promise<number>(() => {})
        const selected = selector((get, options) => {
            signal = options.signal
            get(source)
            return pending
        })

        targetStore.set(source, 1)
        expect(targetStore.get(selected)).toBe(pending)
        expect(signal.aborted).toBe(false)

        targetStore.dispose()
        expect(signal.aborted).toBe(true)
        await settle()
        expect(getStoreData(targetStore).values.get(source)).toBeUndefined()
    })

    test("aborts async selector work retained by a completed transaction", () => {
        const targetStore = store()
        const pending = new Promise<number>(() => {})
        let signal!: AbortSignal
        const selected = selector((_get, options) => {
            signal = options.signal
            return pending
        })

        targetStore.txn(txn => {
            txn.get(selected)
        })
        expect(signal.aborted).toBe(false)

        targetStore.dispose()

        expect(signal.aborted).toBe(true)
    })

    test("rejects every operation after disposal and remains idempotent", () => {
        const targetStore = store({ enumerable: true })
        const target = atom(0)
        const family = atomFamily(0)
        const member = family("member")
        let retainedTransaction: any
        targetStore.get(target)
        targetStore.get(member)
        targetStore.txn(transaction => {
            retainedTransaction = transaction
        })
        targetStore.dispose()

        const operations = [
            () => targetStore.get(target),
            () => targetStore.set(target, 1),
            () => targetStore.sub(target, () => {}),
            () => targetStore.reset(target),
            () => targetStore.del(member),
            () => targetStore.unset(target),
            () => targetStore.txn(() => {}),
            () => targetStore.scope("later"),
            () => targetStore.onChange(() => {}),
            () => targetStore.onCommitEnd(() => {}),
            () => targetStore.snapshot(),
            () => retainedTransaction.get(target),
            () => retainedTransaction.set(target, 1),
            () =>
                retainedTransaction.batchSetFamilyAtoms(family, [[member, 1]]),
            () => retainedTransaction.reset(target),
            () => retainedTransaction.del(member),
            () => retainedTransaction.unset(target),
            () => retainedTransaction.scope("missing", () => {}),
            () => retainedTransaction.parentScope(() => {}),
        ]

        for (const operation of operations) {
            expect(operation).toThrow(/disposed/i)
        }
        expect(() => targetStore.dispose()).not.toThrow()
    })

    test("continues draining after a lifecycle cleanup throws", () => {
        const targetStore = store()
        const cleanupError = new Error("cleanup failed")
        const trailingCleanup = mock(() => {})
        const first = atom(0, {
            onMount: () => () => {
                throw cleanupError
            },
        })
        const second = atom(0, { onMount: () => trailingCleanup })
        targetStore.sub(first, () => {})
        targetStore.sub(second, () => {})

        expect(() => targetStore.dispose()).toThrow(cleanupError)
        expect(trailingCleanup).toHaveBeenCalledTimes(1)
        expect(() => targetStore.get(first)).toThrow(/disposed/i)
    })

    test("does not swallow a user-thrown StoreDisposedError", () => {
        const cleanupError = new StoreDisposedError("user-cleanup")
        const targetStore = store()
        const target = atom(0, {
            onMount: () => () => {
                throw cleanupError
            },
        })
        targetStore.sub(target, () => {})

        expect(() => targetStore.dispose()).toThrow(cleanupError)
    })
})
