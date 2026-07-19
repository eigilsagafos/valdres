import { getStoreData } from "./getStoreData"
import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

describe("async selector unmount cleanup", () => {
    test("late post-await get cannot resurrect a cleaned selector", async () => {
        const targetStore = store()
        const first = atom(1)
        const late = atom(2)
        let release!: () => void
        const gate = new Promise<void>(resolve => {
            release = resolve
        })
        let signal: AbortSignal | undefined

        const derived = selector((get, options) => {
            signal = options.signal
            const firstValue = get(first)
            return gate.then(() => firstValue + get(late))
        })
        const callback = mock(() => {})
        const unsubscribe = targetStore.sub(derived, callback)
        const pending = targetStore.get(derived) as Promise<number>

        unsubscribe()
        await Promise.resolve()

        expect(signal!.aborted).toBe(false)
        expect(getStoreData(targetStore).values.has(derived)).toBe(false)
        expect(getStoreData(targetStore).stateDependencies.has(derived)).toBe(
            false,
        )
        expect(getStoreData(targetStore).latestEvalContext.has(derived)).toBe(
            false,
        )

        release()
        expect(await pending).toBe(3)
        await Promise.resolve()

        expect(callback).toHaveBeenCalledTimes(0)
        expect(getStoreData(targetStore).values.has(derived)).toBe(false)
        expect(getStoreData(targetStore).stateDependencies.has(derived)).toBe(
            false,
        )
        expect(
            getStoreData(targetStore).stateDependents.get(late)?.has(derived) ??
                false,
        ).toBe(false)
    })

    test("signal first accessed after cleanup remains active", async () => {
        const targetStore = store()
        const source = atom(1)
        let release!: () => void
        const gate = new Promise<void>(resolve => {
            release = resolve
        })

        const derived = selector((get, options) => {
            get(source)
            return gate.then(() => options.signal.aborted)
        })
        const unsubscribe = targetStore.sub(derived, () => {})
        const pending = targetStore.get(derived) as Promise<boolean>

        unsubscribe()
        await Promise.resolve()
        release()

        expect(await pending).toBe(false)
        await Promise.resolve()
        expect(getStoreData(targetStore).values.has(derived)).toBe(false)
        expect(getStoreData(targetStore).stateDependencies.has(derived)).toBe(
            false,
        )
        expect(getStoreData(targetStore).abortControllers.has(derived)).toBe(
            false,
        )
    })

    test("deferred get from a settled selector is read-only after cleanup", async () => {
        const targetStore = store()
        const source = atom(1)
        const late = atom(2)
        let release!: () => void
        const gate = new Promise<void>(resolve => {
            release = resolve
        })

        const derived = selector(get => {
            get(source)
            void gate.then(() => get(late))
            return 1
        })
        const unsubscribe = targetStore.sub(derived, () => {})

        unsubscribe()
        await Promise.resolve()
        release()
        await gate
        await Promise.resolve()

        expect(getStoreData(targetStore).values.has(derived)).toBe(false)
        expect(getStoreData(targetStore).stateDependencies.has(derived)).toBe(
            false,
        )
        expect(
            getStoreData(targetStore).stateDependents.get(late)?.has(derived) ??
                false,
        ).toBe(false)
    })

    test("a cleaned suspended selector does not retry after its dependency resolves", async () => {
        const targetStore = store()
        let resolveDependency!: (value: number) => void
        const dependencyPromise = new Promise<number>(resolve => {
            resolveDependency = resolve
        })
        const asyncDependency = selector(() => dependencyPromise)
        let evaluations = 0
        const derived = selector(get => {
            evaluations++
            return get(asyncDependency) * 2
        })
        const unsubscribe = targetStore.sub(derived, () => {})

        unsubscribe()
        await Promise.resolve()
        resolveDependency(21)
        expect(await dependencyPromise).toBe(21)
        await Promise.resolve()
        await Promise.resolve()

        expect(evaluations).toBe(1)
        expect(getStoreData(targetStore).values.has(asyncDependency)).toBe(
            false,
        )
        expect(getStoreData(targetStore).values.has(derived)).toBe(false)
        expect(getStoreData(targetStore).stateDependencies.has(derived)).toBe(
            false,
        )
    })

    test("old Promise cannot commit through a newer evaluation's graph", async () => {
        const targetStore = store()
        const trigger = atom(0)
        let resolveFirst!: (value: number) => void

        const derived = selector(get => {
            if (get(trigger) === 0) {
                return new Promise<number>(resolve => {
                    resolveFirst = resolve
                })
            }
            throw new Error("newer evaluation failed")
        })
        const unsubscribe = targetStore.sub(derived, () => {})
        const firstPending = targetStore.get(derived) as Promise<number>

        // The newer evaluation installs a new context and retains the existing
        // dependency graph, but its error leaves no cached value. Value/graph
        // presence alone therefore cannot identify the old Promise as stale.
        targetStore.set(trigger, 1)
        expect(getStoreData(targetStore).stateDependencies.has(derived)).toBe(
            true,
        )
        expect(getStoreData(targetStore).values.has(derived)).toBe(false)

        resolveFirst(42)
        expect(await firstPending).toBe(42)
        await Promise.resolve()

        expect(getStoreData(targetStore).values.has(derived)).toBe(false)
        unsubscribe()
    })
})
