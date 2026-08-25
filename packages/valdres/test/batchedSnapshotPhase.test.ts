import { describe, expect, test } from "bun:test"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { store } from "../src/store"
import { storeAdapter } from "../src/lib/storeAdapter"

/**
 * The subscription contract a `useSyncExternalStore`-style consumer depends on:
 *
 *   between two notifications, the snapshot must not change — not even by
 *   reference.
 *
 * React enforces this. After every commit it re-reads `getSnapshot` and compares
 * against the value the render used; a difference means tearing, and it repairs
 * it by calling `forceStoreRerender` — a NESTED update. Under a burst of writes
 * that repair fires on every commit and walks straight into "Maximum update
 * depth exceeded".
 *
 * A `batchUpdates` store broke the contract two independent ways, both only
 * while a batch is open (which is why `act()` — it flushes microtasks
 * synchronously — could not reproduce the crash):
 *
 *   1. `store.get` routes through the open batch, and a staged selector read
 *      was not memoized against the committed value, so an UNCHANGED value came
 *      back as a fresh reference on every read after any `set`.
 *   2. a staged read answers with a write the batch has not committed, and only
 *      the commit notifies — so the snapshot moved with no callback at all.
 *
 * (1) is fixed in the transaction read itself, so explicit `store.txn` bodies
 * get the same memoization. (2) is fixed by reading the committed value for
 * snapshots — `store.get` keeps its documented read-your-writes behavior.
 */

const tick = () => new Promise<void>(resolve => queueMicrotask(resolve))

// Deep-equal-but-fresh on every evaluation — the shape of any selector that
// derives a list or object.
const numbers = atom([1, 2, 3], { name: "numbers" })
const derived = selector(get => get(numbers).map(n => ({ n })), {
    name: "derived",
})

describe("batched store snapshots stay in phase with notifications", () => {
    for (const batchUpdates of [false, true]) {
        const label = batchUpdates ? "batched" : "unbatched"

        test(`${label}: a write of a deep-equal value keeps the reference`, async () => {
            const testStore = store({ batchUpdates })
            let notifications = 0
            testStore.sub(derived, () => void notifications++, false)

            const first = storeAdapter.committedGet(testStore, derived)
            testStore.set(numbers, [1, 2, 3])
            // Mid-batch: nothing changed, so nothing may move.
            expect(storeAdapter.committedGet(testStore, derived)).toBe(first)
            await tick()
            expect(storeAdapter.committedGet(testStore, derived)).toBe(first)
            expect(notifications).toBe(0)
        })

        test(`${label}: a burst of writes never moves the snapshot unannounced`, async () => {
            const testStore = store({ batchUpdates })
            let notifications = 0
            testStore.sub(derived, () => void notifications++, false)

            let lastSeen = storeAdapter.committedGet(testStore, derived)
            let notificationsAtLastSeen = notifications
            let unannouncedChanges = 0
            // React reads the snapshot at points the store cannot predict:
            // during render, and again after commit. Probe between writes.
            const probe = () => {
                const seen = storeAdapter.committedGet(testStore, derived)
                if (
                    seen !== lastSeen &&
                    notifications === notificationsAtLastSeen
                ) {
                    unannouncedChanges++
                }
                lastSeen = seen
                notificationsAtLastSeen = notifications
            }

            // A streaming load: several writes per microtask, many microtasks,
            // with the selector value genuinely growing.
            for (let pass = 0; pass < 25; pass++) {
                for (let write = 0; write < 3; write++) {
                    testStore.set(
                        numbers,
                        Array.from({ length: pass + 1 }, (_, i) => i),
                    )
                    probe()
                }
                await tick()
                probe()
            }

            expect(unannouncedChanges).toBe(0)
            expect(notifications).toBe(25)
        })
    }

    test("store.get keeps reading through the open batch", async () => {
        const testStore = store({ batchUpdates: true })
        testStore.set(numbers, [7, 8])
        // Read-your-writes is the documented behavior of a batched store.get,
        // and it is deliberately NOT what a snapshot read does.
        expect(testStore.get(numbers)).toStrictEqual([7, 8])
        expect(testStore.get(derived)).toStrictEqual([{ n: 7 }, { n: 8 }])
        expect(storeAdapter.committedGet(testStore, numbers)).toStrictEqual([
            1, 2, 3,
        ])
        await tick()
        expect(storeAdapter.committedGet(testStore, numbers)).toStrictEqual([
            7, 8,
        ])
    })

    test("a scope's staged read is memoized against the scope's own value", async () => {
        // A scope materializes its own committed entry for a selector it reads,
        // so the memoization anchors in `this._data.values` — the same map
        // initSelector uses. If a scope resolved through the parent instead,
        // the anchor would be missing and the churn would be back for every
        // <Scope>-rendered subtree.
        const root = store({ batchUpdates: true })
        const scoped = root.scope("child")
        const first = storeAdapter.committedGet(scoped, derived)

        scoped.set(numbers, [1, 2, 3])
        expect(storeAdapter.committedGet(scoped, derived)).toBe(first)
        await tick()
        expect(storeAdapter.committedGet(scoped, derived)).toBe(first)

        scoped.txn(txn => {
            expect(txn.get(derived)).toBe(first)
            txn.set(numbers, [1, 2, 3])
            expect(txn.get(derived)).toBe(first)
        })
        root.dispose()
    })

    test("an async selector value is not memoized across promises", async () => {
        // Promises compare by reference on the committed paths (deep equal
        // treats every promise as identical, having no own keys), so the staged
        // read must not fold two distinct promises together. Guarding this
        // matters because useValue THROWS a promise-like snapshot for Suspense.
        const source = atom(Promise.resolve(1), { name: "asyncSource" })
        const asyncDerived = selector(get => get(source), {
            name: "asyncDerived",
        })
        const testStore = store({ batchUpdates: true })
        expect(await testStore.get(asyncDerived)).toBe(1)

        const next = Promise.resolve(2)
        testStore.set(source, next)
        await tick()
        expect(await storeAdapter.committedGet(testStore, asyncDerived)).toBe(2)
        testStore.dispose()
    })

    test("a staged selector read is memoized against the committed value", () => {
        const testStore = store({ batchUpdates: false })
        const committed = testStore.get(derived)
        testStore.txn(txn => {
            // Staging a deep-equal value must not manufacture a new reference,
            // the same rule the committed evaluators follow. Read twice across
            // a write, because a write clears the transaction's selector cache.
            expect(txn.get(derived)).toBe(committed)
            txn.set(numbers, [1, 2, 3])
            expect(txn.get(derived)).toBe(committed)
            // A genuine change still produces a new value.
            txn.set(numbers, [1, 2, 3, 4])
            expect(txn.get(derived)).toStrictEqual([
                { n: 1 },
                { n: 2 },
                { n: 3 },
                { n: 4 },
            ])
        })
    })
})
