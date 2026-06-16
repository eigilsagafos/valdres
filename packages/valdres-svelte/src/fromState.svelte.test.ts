import { describe, test, expect } from "bun:test"
import { mount, unmount, flushSync } from "svelte"
import { atom, selector, store } from "valdres"
import { fromState } from "./fromState"
import FromStateCounter from "../test/components/FromStateCounter.svelte"
import LazyProbe from "../test/components/LazyProbe.svelte"

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe("fromState (value semantics, no effect needed)", () => {
    test("reads the current atom value", () => {
        const s = store()
        const box = fromState(atom(42), s)
        expect(box.current).toBe(42)
    })

    test(".current setter writes through the store", () => {
        const countAtom = atom(0)
        const s = store()
        const box = fromState(countAtom, s)
        box.current = 5
        expect(s.get(countAtom)).toBe(5)
        expect(box.current).toBe(5)
    })

    test(".current setter stores a function value verbatim (thunk-wrapped)", () => {
        const fnAtom = atom<() => number>(() => 1)
        const s = store()
        const box = fromState(fnAtom, s)
        const next = () => 2
        box.current = next
        expect(s.get(fnAtom)).toBe(next)
        expect(s.get(fnAtom)()).toBe(2)
    })

    test("update applies the read-modify-write updater", () => {
        const countAtom = atom(1)
        const s = store()
        const box = fromState(countAtom, s)
        box.update(c => c + 10)
        expect(s.get(countAtom)).toBe(11)
    })

    test("reset restores the default value", () => {
        const countAtom = atom(42)
        const s = store()
        s.set(countAtom, 100)
        fromState(countAtom, s).reset()
        expect(s.get(countAtom)).toBe(42)
    })

    test("selector box is read-only and re-reads live", () => {
        const countAtom = atom(3)
        const doubled = selector(get => get(countAtom) * 2)
        const s = store()
        const box = fromState(doubled, s)
        expect(box.current).toBe(6)
        expect("set" in box).toBe(false)
        expect("reset" in box).toBe(false)
        s.set(countAtom, 5)
        expect(box.current).toBe(10)
    })
})

describe("fromState (mounted reactivity)", () => {
    test("renders the value and reacts to store changes", () => {
        const countAtom = atom(0)
        const s = store()
        const target = document.createElement("div")
        const comp = mount(FromStateCounter, {
            target,
            props: { store: s, countAtom },
        })

        const button = target.querySelector("button")!
        expect(button.textContent).toBe("count is 0")

        s.set(countAtom, 5)
        flushSync()
        expect(button.textContent).toBe("count is 5")

        unmount(comp)
    })

    test("clicking updates the atom via the .current setter", () => {
        const countAtom = atom(10)
        const s = store()
        const target = document.createElement("div")
        const comp = mount(FromStateCounter, {
            target,
            props: { store: s, countAtom },
        })

        target.querySelector("button")!.click()
        flushSync()
        expect(s.get(countAtom)).toBe(11)

        unmount(comp)
    })

    test("bind:value={count.current} writes back to the atom", () => {
        const countAtom = atom(0)
        const s = store()
        const target = document.createElement("div")
        const comp = mount(FromStateCounter, {
            target,
            props: { store: s, countAtom },
        })

        const input = target.querySelector("input")!
        input.value = "7"
        input.dispatchEvent(new Event("input", { bubbles: true }))
        flushSync()
        expect(s.get(countAtom)).toBe(7)

        unmount(comp)
    })
})

describe("fromState (lazy bootstrap via createSubscriber)", () => {
    test("reading .current in the template starts the onMount subscription, and unmount tears it down", async () => {
        let starts = 0
        let stops = 0
        const liveAtom = atom(0, {
            onMount: () => {
                starts++
                return () => stops++
            },
        })
        const s = store()
        const target = document.createElement("div")
        const comp = mount(LazyProbe, {
            target,
            props: { atom: liveAtom, store: s, renderValue: true },
        })

        // Template reads .current inside an effect → subscription started.
        expect(starts).toBe(1)
        expect(stops).toBe(0)

        unmount(comp)
        await tick() // createSubscriber tears down on a microtask after destroy
        expect(stops).toBe(1)
    })

    test("an atom read only from an event handler never bootstraps", () => {
        let starts = 0
        const liveAtom = atom(0, {
            onMount: () => {
                starts++
                return () => {}
            },
        })
        const s = store()
        const target = document.createElement("div")
        const comp = mount(LazyProbe, {
            target,
            props: { atom: liveAtom, store: s, renderValue: false },
        })

        // Never read in the template → no subscription.
        expect(starts).toBe(0)

        // Reading in a handler doesn't subscribe either (store.get, no sub).
        target.querySelector("button")!.click()
        flushSync()
        expect(starts).toBe(0)

        unmount(comp)
    })
})
