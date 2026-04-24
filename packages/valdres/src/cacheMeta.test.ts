import { describe, test, expect, mock } from "bun:test"
import { atom } from "./atom"
import { cacheMeta } from "./cacheMeta"
import { selector } from "./selector"
import { store } from "./store"
import { wait } from "../test/utils/wait"

const waitFor = async (callback: () => void, count = 0, maxRetries = 200) => {
    try {
        callback()
        return
    } catch (e) {
        if (count >= maxRetries) {
            throw new Error(`waitFor timed out after ${maxRetries} retries`, { cause: e })
        }
        await wait(1)
        return waitFor(callback, count + 1, maxRetries)
    }
}

describe("cacheMeta", () => {
    test("returns cache metadata for atom with maxAge", async () => {
        const store1 = store()
        let fetchCount = 0
        const atom1 = atom(() => ++fetchCount, { maxAge: 20 })

        const callback = mock(() => {})
        store1.sub(atom1, callback)

        const meta = store1.get(cacheMeta(atom1))
        expect(meta).toBeDefined()
        expect(meta!.isRevalidating).toBe(false)
        expect(meta!.maxAge).toBe(20)
        expect(meta!.lastSuccessAt).toBeGreaterThan(0)
    })

    test("returns null for atom without maxAge", () => {
        const store1 = store()
        const atom1 = atom(42)

        store1.sub(atom1, () => {})

        const meta = store1.get(cacheMeta(atom1))
        expect(meta).toBeNull()
    })

    test("isRevalidating updates during async revalidation", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<{ resolve: (v: any) => void }> = []

        const atom1 = atom(
            () =>
                new Promise(resolve => {
                    resolvers.push({ resolve })
                    fetchCount++
                }),
            { maxAge: 20, staleWhileRevalidate: 200 },
        )

        // Record every isRevalidating emission. The setInterval driving
        // revalidation keeps firing, so sampling the *current* value races
        // against the next tick — we assert on the history instead.
        const history: boolean[] = []
        const metaSel = cacheMeta(atom1)
        store1.sub(metaSel, () => {
            const m = store1.get(metaSel)
            if (m) history.push(m.isRevalidating)
        })

        store1.sub(atom1, () => {})
        resolvers[0].resolve(100)

        // Wait until revalidation starts (first true)
        await waitFor(() => expect(history).toContain(true))
        const firstTrueIdx = history.indexOf(true)
        expect(fetchCount).toBeGreaterThanOrEqual(2)

        // Resolve the revalidation. isRevalidating must flip to false
        // at least once *after* we observed it go true.
        resolvers[1].resolve(200)
        await waitFor(() =>
            expect(history.slice(firstTrueIdx + 1)).toContain(false),
        )
    })

    test("cacheMeta is reactive via subscriptions", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<{ resolve: (v: any) => void }> = []

        const atom1 = atom(
            () =>
                new Promise(resolve => {
                    resolvers.push({ resolve })
                    fetchCount++
                }),
            { maxAge: 20, staleWhileRevalidate: 200 },
        )

        const metaSelector = cacheMeta(atom1)
        store1.sub(atom1, () => {})
        resolvers[0].resolve(100)
        await wait(1)

        const metaCallback = mock(() => {})
        store1.sub(metaSelector, metaCallback, false)

        // Wait for revalidation to start
        await waitFor(() => expect(fetchCount).toBe(2))
        // Give propagation time to reach the selector subscriber
        await wait(5)

        // metaCallback should have been called when isRevalidating changed
        expect(metaCallback).toHaveBeenCalled()
    })

    test("cacheMeta reflects staleWhileRevalidate and staleIfError config", async () => {
        const store1 = store()
        const atom1 = atom(() => 42, {
            maxAge: 100,
            staleWhileRevalidate: 500,
            staleIfError: 1000,
        })

        store1.sub(atom1, () => {})

        const meta = store1.get(cacheMeta(atom1))
        expect(meta!.maxAge).toBe(100)
        expect(meta!.staleWhileRevalidate).toBe(500)
        expect(meta!.staleIfError).toBe(1000)
    })
})

describe("reactive maxAge", () => {
    test("maxAge as atom changes interval timing", async () => {
        const store1 = store()
        let fetchCount = 0
        const maxAgeAtom = atom(50)

        const atom1 = atom(() => ++fetchCount, { maxAge: maxAgeAtom })

        store1.sub(atom1, () => {})
        expect(fetchCount).toBe(1)

        // Wait for first revalidation at 50ms
        await waitFor(() => expect(fetchCount).toBe(2))

        // Change maxAge to much longer — should slow down
        store1.set(maxAgeAtom, 5000)

        const countAfterChange = fetchCount
        await wait(100)

        // Should not have fired again with the long interval
        expect(fetchCount).toBeLessThanOrEqual(countAfterChange + 1)
    })

    test("maxAge as atom reflects in cacheMeta", async () => {
        const store1 = store()
        const maxAgeAtom = atom(50)
        const atom1 = atom(() => 42, { maxAge: maxAgeAtom })

        store1.sub(atom1, () => {})

        expect(store1.get(cacheMeta(atom1))!.maxAge).toBe(50)

        store1.set(maxAgeAtom, 200)

        expect(store1.get(cacheMeta(atom1))!.maxAge).toBe(200)
    })

    test("maxAge as selector", async () => {
        const store1 = store()
        let fetchCount = 0
        const fastMode = atom(true)
        const maxAgeSelector = selector(get => (get(fastMode) ? 20 : 5000))

        const atom1 = atom(() => ++fetchCount, { maxAge: maxAgeSelector })

        store1.sub(atom1, () => {})
        expect(fetchCount).toBe(1)

        // Fast mode: should revalidate quickly
        await waitFor(() => expect(fetchCount).toBe(2))

        // Switch to slow mode
        store1.set(fastMode, false)
        const countAfterSwitch = fetchCount
        await wait(80)

        // Should not have revalidated again with 5000ms interval
        expect(fetchCount).toBeLessThanOrEqual(countAfterSwitch + 1)
    })

    test("staleWhileRevalidate as atom", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<{ resolve: (v: any) => void }> = []
        const swrAtom = atom(200)

        const atom1 = atom(
            () =>
                new Promise(resolve => {
                    resolvers.push({ resolve })
                    fetchCount++
                }),
            { maxAge: 20, staleWhileRevalidate: swrAtom },
        )

        store1.sub(atom1, () => {})
        resolvers[0].resolve(100)
        await wait(1)

        expect(store1.get(atom1)).toBe(100)

        // Wait for revalidation
        await waitFor(() => expect(fetchCount).toBe(2))

        // SWR: stale value should still be visible
        expect(store1.get(atom1)).toBe(100)

        // Resolve revalidation
        resolvers[1].resolve(200)
        await wait(1)
        expect(store1.get(atom1)).toBe(200)

        // cacheMeta reflects SWR value
        expect(store1.get(cacheMeta(atom1))!.staleWhileRevalidate).toBe(200)

        // Change SWR
        store1.set(swrAtom, 500)
        expect(store1.get(cacheMeta(atom1))!.staleWhileRevalidate).toBe(500)
    })

    test("staleIfError as atom", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<{
            resolve: (v: any) => void
            reject: (e: any) => void
        }>[] = []
        const staleIfErrorAtom = atom(500)

        const atom1 = atom(
            () =>
                new Promise((resolve, reject) => {
                    resolvers.push([{ resolve, reject }])
                    fetchCount++
                }),
            {
                maxAge: 20,
                staleWhileRevalidate: 200,
                staleIfError: staleIfErrorAtom,
            },
        )

        store1.sub(atom1, () => {})
        resolvers[0][0].resolve(100)
        await wait(1)

        expect(store1.get(cacheMeta(atom1))!.staleIfError).toBe(500)

        store1.set(staleIfErrorAtom, 1000)
        expect(store1.get(cacheMeta(atom1))!.staleIfError).toBe(1000)
    })

    test("global atom: cacheMeta visible in both stores with single interval", async () => {
        const store1 = store()
        const store2 = store()
        let fetchCount = 0

        const atom1 = atom(() => ++fetchCount, {
            global: true,
            maxAge: 30,
        })

        store1.sub(atom1, () => {})
        store2.sub(atom1, () => {})

        // Global atoms call defaultValue during init for each store + globalStore
        const countAfterInit = fetchCount

        // Both stores see cacheMeta
        const meta1 = store1.get(cacheMeta(atom1))
        const meta2 = store2.get(cacheMeta(atom1))
        expect(meta1).toBeDefined()
        expect(meta2).toBeDefined()
        expect(meta1!.maxAge).toBe(30)
        expect(meta2!.maxAge).toBe(30)
        expect(meta1!.isRevalidating).toBe(false)
        expect(meta2!.isRevalidating).toBe(false)

        // Wait for exactly one revalidation — only one interval should fire
        await waitFor(() => expect(fetchCount).toBe(countAfterInit + 1))

        // Only one extra call, not two (proves single interval)
        expect(fetchCount).toBe(countAfterInit + 1)

        // Both stores see the updated value
        expect(store1.get(atom1)).toBe(store2.get(atom1))
    })

    test("global atom: reactive maxAge restarts the shared interval", async () => {
        const store1 = store()
        const store2 = store()
        let fetchCount = 0
        const maxAgeAtom = atom(30)

        const atom1 = atom(() => ++fetchCount, {
            global: true,
            maxAge: maxAgeAtom,
        })

        store1.sub(atom1, () => {})
        store2.sub(atom1, () => {})
        const countAfterInit = fetchCount

        // Wait for first revalidation
        await waitFor(() => expect(fetchCount).toBe(countAfterInit + 1))

        // Both stores see the value
        expect(store1.get(atom1)).toBe(store2.get(atom1))

        // Change maxAge to very long — should slow down
        store1.set(maxAgeAtom, 5000)

        // cacheMeta reflects the new maxAge in both stores
        expect(store1.get(cacheMeta(atom1))!.maxAge).toBe(5000)
        expect(store2.get(cacheMeta(atom1))!.maxAge).toBe(5000)

        const countAfterChange = fetchCount
        await wait(100)

        // Should not have revalidated again with the long interval
        expect(fetchCount).toBeLessThanOrEqual(countAfterChange + 1)
    })

    test("unsubscribe cleans up reactive config subscriptions", async () => {
        const store1 = store()
        let fetchCount = 0
        const maxAgeAtom = atom(30)

        const atom1 = atom(() => ++fetchCount, { maxAge: maxAgeAtom })

        const unsub = store1.sub(atom1, () => {})
        expect(fetchCount).toBe(1)

        // Wait for one revalidation
        await waitFor(() => expect(fetchCount).toBe(2))

        // Unsubscribe — should clean up both the interval and the reactive sub
        unsub()

        const countAfterUnsub = fetchCount
        await wait(100)

        // No more revalidation calls
        expect(fetchCount).toBe(countAfterUnsub)

        // Setting the maxAge atom should not cause errors or side effects
        store1.set(maxAgeAtom, 1)
        await wait(50)
        expect(fetchCount).toBe(countAfterUnsub)
    })

    test("cacheMeta returns null before any subscription", () => {
        const store1 = store()
        const atom1 = atom(() => 42, { maxAge: 100 })

        // Read cacheMeta before subscribing to atom1
        const meta = store1.get(cacheMeta(atom1))
        expect(meta).toBeNull()
    })

    test("static number maxAge still works (no regression)", async () => {
        const store1 = store()
        let fetchCount = 0
        const atom1 = atom(() => ++fetchCount, { maxAge: 20 })

        const callback = mock(() => {})
        store1.sub(atom1, callback)
        expect(fetchCount).toBe(1)

        await waitFor(() => expect(fetchCount).toBe(2))
        expect(store1.get(atom1)).toBe(2)
    })
})
