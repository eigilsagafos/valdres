import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import { atom, store, type Store } from "valdres"
import { useAtom } from "./useAtom"
import { useResetAtom } from "./useResetAtom"
import { useSetAtom } from "./useSetAtom"
import { useUpdateAtom } from "./useUpdateAtom"

afterEach(cleanup)

describe("Atom hooks", () => {
    test("useAtom reads and stores exact values", () => {
        const count = atom(0)
        const selectedStore = store()
        const { result } = renderHook(() => useAtom(count, selectedStore))

        act(() => result.current[1](2))

        expect(result.current[0]).toBe(2)
        expect(selectedStore.get(count)).toBe(2)
    })

    test("useSetAtom stores a function value instead of invoking it", () => {
        const initial = () => 1
        const next = () => 2
        const callbackAtom = atom<() => number>(initial)
        const selectedStore = store()
        const { result } = renderHook(() =>
            useSetAtom(callbackAtom, selectedStore),
        )

        act(() => result.current(next))

        expect(selectedStore.get(callbackAtom)).toBe(next)
        expect(selectedStore.get(callbackAtom)()).toBe(2)
    })

    test("useUpdateAtom applies an updater without subscribing", () => {
        const count = atom(1)
        const selectedStore = store()
        const { result } = renderHook(() => useUpdateAtom(count, selectedStore))

        act(() => result.current((current: number) => current + 2))

        expect(selectedStore.get(count)).toBe(3)
    })

    test("useResetAtom restores live parent inheritance in a scope", () => {
        const count = atom(1)
        const rootStore = store()
        const childStore = rootStore.scope()
        childStore.set(count, 9)
        const { result } = renderHook(() => useResetAtom(count, childStore))

        act(() => result.current())
        expect(childStore.get(count)).toBe(1)

        rootStore.set(count, 4)
        expect(childStore.get(count)).toBe(4)
    })

    test("write callbacks remain stable until the selected Store changes", () => {
        const count = atom(0)
        const first = store()
        const second = store()
        const { result, rerender } = renderHook(
            ({ target }: { readonly target: Store }) =>
                useUpdateAtom(count, target),
            { initialProps: { target: first } },
        )
        const firstCallback = result.current

        rerender({ target: first })
        expect(result.current).toBe(firstCallback)

        rerender({ target: second })
        expect(result.current).not.toBe(firstCallback)
    })
})
