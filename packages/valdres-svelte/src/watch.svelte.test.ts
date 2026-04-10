import { describe, test, expect } from "bun:test"
import { atom, selector, store } from "valdres"
import { flushSync } from "svelte"
import { effect_root } from "svelte/internal/client"
import { watch } from "./watch.svelte"

describe("watch", () => {
    test("returns current atom value", () => {
        const countAtom = atom(42)
        const s = store()

        const cleanup = effect_root(() => {
            const count = watch(countAtom, s)
            expect(count.value).toBe(42)
        })
        cleanup()
    })

    test("returns set and reset for atoms", () => {
        const countAtom = atom(0)
        const s = store()

        const cleanup = effect_root(() => {
            const count = watch(countAtom, s)
            expect(typeof count.set).toBe("function")
            expect(typeof count.reset).toBe("function")
        })
        cleanup()
    })

    test("does not return set or reset for selectors", () => {
        const countAtom = atom(0)
        const doubled = selector(get => get(countAtom) * 2)
        const s = store()

        const cleanup = effect_root(() => {
            const val = watch(doubled, s)
            expect(val.value).toBe(0)
            expect("set" in val).toBe(false)
            expect("reset" in val).toBe(false)
        })
        cleanup()
    })

    test("set updates the store value", () => {
        const countAtom = atom(0)
        const s = store()

        const cleanup = effect_root(() => {
            const count = watch(countAtom, s)
            count.set(5)
            expect(s.get(countAtom)).toBe(5)
        })
        cleanup()
    })

    test("reset restores default value", () => {
        const countAtom = atom(42)
        const s = store()
        s.set(countAtom, 100)

        const cleanup = effect_root(() => {
            const count = watch(countAtom, s)
            count.reset()
            expect(s.get(countAtom)).toBe(42)
        })
        cleanup()
    })

    test("value updates reactively on store change", () => {
        const countAtom = atom(0)
        const s = store()

        const cleanup = effect_root(() => {
            const count = watch(countAtom, s)
            expect(count.value).toBe(0)

            s.set(countAtom, 10)
            flushSync()
            expect(count.value).toBe(10)

            s.set(countAtom, 20)
            flushSync()
            expect(count.value).toBe(20)
        })
        cleanup()
    })

    test("selector value updates when dependency changes", () => {
        const countAtom = atom(3)
        const doubled = selector(get => get(countAtom) * 2)
        const s = store()

        const cleanup = effect_root(() => {
            const val = watch(doubled, s)
            expect(val.value).toBe(6)

            s.set(countAtom, 5)
            flushSync()
            expect(val.value).toBe(10)
        })
        cleanup()
    })
})
