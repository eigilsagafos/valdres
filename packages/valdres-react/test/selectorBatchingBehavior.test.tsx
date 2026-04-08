import { describe, test, expect, mock } from "bun:test"
import { atom, selector } from "valdres"
import { generateStoreAndRenderHook } from "./generateStoreAndRenderHook"
import { useValue } from "../src/useValue"

describe("selector evaluation batching: sequential set vs txn", () => {
    test("sequential store.set batches via implicit transaction", () => {
        const atomA = atom(0)
        const atomB = atom(0)
        const selectorFn = mock(get => get(atomA) + get(atomB))
        const derived = selector(selectorFn)

        const [store, renderHook] = generateStoreAndRenderHook()

        let renderCount = 0
        const { result, rerender } = renderHook(() => {
            renderCount++
            return useValue(derived)
        })

        // Initial render: selector evaluates, result is 0+0=0
        expect(result.current).toBe(0)
        const initialSelectorCalls = selectorFn.mock.calls.length
        const initialRenderCount = renderCount

        // Sequential sets: atomA=1, then atomB=2
        // These are auto-batched into an implicit transaction that commits
        // on the next microtask, so the selector only evaluates once with
        // the final state [1, 2] — no intermediate [1, 0] evaluation.
        store.set(atomA, 1)
        store.set(atomB, 2)
        rerender()

        expect(result.current).toBe(3)

        const selectorCallsAfterSet =
            selectorFn.mock.calls.length - initialSelectorCalls
        expect(selectorCallsAfterSet).toBe(1) // only final [1,2], no intermediate

        const rendersAfterSet = renderCount - initialRenderCount
        expect(rendersAfterSet).toBe(1)
    })

    test("store.txn batches updates: selector evaluates only with final state", () => {
        const atomA = atom(0)
        const atomB = atom(0)
        const selectorFn = mock(get => get(atomA) + get(atomB))
        const derived = selector(selectorFn)

        const [store, renderHook] = generateStoreAndRenderHook()

        let renderCount = 0
        const { result, rerender } = renderHook(() => {
            renderCount++
            return useValue(derived)
        })

        // Initial render: selector evaluates, result is 0+0=0
        expect(result.current).toBe(0)
        const initialSelectorCalls = selectorFn.mock.calls.length
        const initialRenderCount = renderCount

        // Explicit transaction: both atoms updated atomically
        store.txn(({ set }) => {
            set(atomA, 1)
            set(atomB, 2)
        })
        rerender()

        expect(result.current).toBe(3)

        // The selector is evaluated only once with the final state [1, 2].
        const selectorCallsAfterTxn =
            selectorFn.mock.calls.length - initialSelectorCalls
        expect(selectorCallsAfterTxn).toBe(1) // only final [1,2]

        const rendersAfterTxn = renderCount - initialRenderCount
        expect(rendersAfterTxn).toBe(1)
    })

    test("store.get() reads buffered values before microtask commit", () => {
        const atomA = atom(0)
        const atomB = atom(0)
        const selectorFn = mock(get => get(atomA) + get(atomB))
        const derived = selector(selectorFn)

        const [store, renderHook] = generateStoreAndRenderHook()
        renderHook(() => useValue(derived))

        // Set values sequentially
        store.set(atomA, 1)
        store.set(atomB, 2)

        // store.get() should read through the implicit transaction buffer
        expect(store.get(atomA)).toBe(1)
        expect(store.get(atomB)).toBe(2)
        expect(store.get(derived)).toBe(3)
    })
})
