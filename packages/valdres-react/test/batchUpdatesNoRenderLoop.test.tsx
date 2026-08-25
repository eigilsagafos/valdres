import { render, act } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import { atom, selector, store } from "valdres"
import { Provider } from "../src/Provider"
import { useValue } from "../src/useValue"
import { flushBatch } from "./flushBatch"

/**
 * `useValue` must not hand React a snapshot that moves without a notification.
 *
 * React re-reads `getSnapshot` after every commit and compares it against the
 * value the render used. A difference means tearing, and React repairs it with
 * `forceStoreRerender` — a NESTED update. A `batchUpdates` store used to fail
 * that check on every commit (`store.get` answers from the open batch, but only
 * the commit notifies), so a streaming load hit "Maximum update depth
 * exceeded".
 *
 * NOTE ON WHAT IS TESTABLE HERE: the crash itself needs a real browser. `act`
 * drains microtasks synchronously, so a batch is never still open at the moment
 * React samples the snapshot, and a render-loop assertion would pass with or
 * without the fix. These tests therefore pin the INVARIANT the loop violated —
 * the snapshot only moves when a notification says so — which is deterministic
 * here and fails without the fix. The unbounded-loop repro lives at the store
 * level, in valdres' `batchedSnapshotPhase.test.ts`.
 */
describe("batchUpdates keeps useValue's snapshot in phase", () => {
    test("a re-render while a batch is open sees the same value", async () => {
        const entities = atom<Record<string, number>>({}, { name: "entities" })
        const ids = selector(
            get => Object.keys(get(entities)).map(id => ({ id })),
            { name: "ids" },
        )
        const testStore = store({ batchUpdates: true })
        const seen: unknown[] = []

        const Subscriber = () => {
            seen.push(useValue(ids))
            return null
        }

        const { rerender } = render(
            <Provider store={testStore}>
                <Subscriber />
            </Provider>,
        )
        const atMount = seen.at(-1)

        // Open a batch and force a render before it commits. No notification
        // has fired, so the value React sees must not have moved — by
        // reference. Reading the staged write here is what React diagnoses as
        // tearing.
        testStore.set(entities, { a: 1 })
        rerender(
            <Provider store={testStore}>
                <Subscriber />
            </Provider>,
        )
        expect(seen.at(-1)).toBe(atMount)

        // The commit is what publishes the write.
        await flushBatch()
        expect(seen.at(-1)).toStrictEqual([{ id: "a" }])
        testStore.dispose()
    })

    test("a write of an unchanged value does not re-render", async () => {
        const constant = atom({ a: 1 }, { name: "constant" })
        const derived = selector(get => ({ ...get(constant) }), {
            name: "constantDerived",
        })
        const testStore = store({ batchUpdates: true })
        let renders = 0

        const Subscriber = () => {
            useValue(derived)
            renders++
            return null
        }

        await act(async () => {
            render(
                <Provider store={testStore}>
                    <Subscriber />
                </Provider>,
            )
        })
        const initialRenders = renders

        for (let i = 0; i < 10; i++) {
            await act(async () => {
                testStore.set(constant, { a: 1 })
            })
        }

        expect(renders).toBe(initialRenders)
        testStore.dispose()
    })
})
