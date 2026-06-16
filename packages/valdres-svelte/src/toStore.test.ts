import { describe, test, expect, mock } from "bun:test"
import { atom, selector, store } from "valdres"
import { toStore } from "./toStore"

describe("toStore", () => {
    test("atom yields a Writable: subscribe fires immediately then on change", () => {
        const countAtom = atom(42)
        const s = store()
        const count$ = toStore(countAtom, s)

        const values: number[] = []
        count$.subscribe(v => values.push(v))
        s.set(countAtom, 1)
        expect(values).toEqual([42, 1])
    })

    test("atom set delegates to the store", () => {
        const countAtom = atom(0)
        const s = store()
        const count$ = toStore(countAtom, s)
        count$.set(9)
        expect(s.get(countAtom)).toBe(9)
    })

    test("atom set stores a function value verbatim", () => {
        const fnAtom = atom<() => number>(() => 1)
        const s = store()
        const next = () => 2
        toStore(fnAtom, s).set(next)
        expect(s.get(fnAtom)).toBe(next)
    })

    test("atom update applies the updater", () => {
        const countAtom = atom(5)
        const s = store()
        toStore(countAtom, s).update(c => c + 3)
        expect(s.get(countAtom)).toBe(8)
    })

    test("returns an unsubscribe function", () => {
        const countAtom = atom(0)
        const s = store()
        const values: number[] = []
        const unsub = toStore(countAtom, s).subscribe(v => values.push(v))
        s.set(countAtom, 1)
        unsub()
        s.set(countAtom, 2)
        expect(values).toEqual([0, 1])
    })

    test("selector yields a read-only Readable (no set/update)", () => {
        const countAtom = atom(3)
        const doubled = selector(get => get(countAtom) * 2)
        const s = store()
        const double$ = toStore(doubled, s)

        const cb = mock(() => {})
        double$.subscribe(cb)
        expect(cb).toHaveBeenCalledWith(6)
        expect("set" in double$).toBe(false)
        expect("update" in double$).toBe(false)
    })
})
