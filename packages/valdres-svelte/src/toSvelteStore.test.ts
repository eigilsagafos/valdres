import { describe, test, expect, mock } from "bun:test"
import { atom, store } from "valdres"
import { toSvelteStore } from "./toSvelteStore"

describe("toSvelteStore", () => {
    test("calls subscriber immediately with current value", () => {
        const countAtom = atom(42)
        const s = store()
        const readable = toSvelteStore(countAtom, s)

        const callback = mock(() => {})
        readable.subscribe(callback)

        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith(42)
    })

    test("notifies subscriber on atom change", () => {
        const countAtom = atom(0)
        const s = store()
        const readable = toSvelteStore(countAtom, s)

        const values: number[] = []
        readable.subscribe(v => values.push(v))

        s.set(countAtom, 1)
        s.set(countAtom, 2)

        expect(values).toEqual([0, 1, 2])
    })

    test("returns unsubscribe function", () => {
        const countAtom = atom(0)
        const s = store()
        const readable = toSvelteStore(countAtom, s)

        const values: number[] = []
        const unsub = readable.subscribe(v => values.push(v))

        s.set(countAtom, 1)
        unsub()
        s.set(countAtom, 2)

        expect(values).toEqual([0, 1])
    })

    test("works with string atoms", () => {
        const nameAtom = atom("hello")
        const s = store()
        const readable = toSvelteStore(nameAtom, s)

        const values: string[] = []
        readable.subscribe(v => values.push(v))

        s.set(nameAtom, "world")

        expect(values).toEqual(["hello", "world"])
    })
})
