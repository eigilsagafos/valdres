import { describe, expect, test } from "bun:test"
import { LeakDetector } from "../../../../test/src/LeakDetector"
import { createStore } from "../../src/createStore"
import { atom } from "../../src/atom"
import type { Atom } from "jotai/vanilla"

describe("memory leaks (get & set only)", () => {
    test("one atom", async () => {
        const store = createStore()
        let objAtom: Atom<object> | undefined = atom({})
        const detector = new LeakDetector(store.get(objAtom))
        objAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("two atoms", async () => {
        const store = createStore()
        let objAtom: Atom<object> | undefined = atom({})
        const detector1 = new LeakDetector(store.get(objAtom))
        let derivedAtom: Atom<object> | undefined = atom(get => ({
            obj: objAtom && get(objAtom),
        }))
        const detector2 = new LeakDetector(store.get(derivedAtom))
        objAtom = undefined
        derivedAtom = undefined
        expect(await detector1.isLeaking()).toBe(false)
        expect(await detector2.isLeaking()).toBe(false)
    })

    test.todo(
        "should not hold onto dependent atoms that are not mounted",
        // async () => {
        //     const store = createStore()
        //     const objAtom = atom({})
        //     let depAtom: Atom<unknown> | undefined = atom(get => get(objAtom))
        //     const detector = new LeakDetector(depAtom)
        //     store.get(depAtom)
        //     depAtom = undefined
        //     expect(await detector.isLeaking()).toBe(false)
        // },
    )

    test("with a long-lived base atom", async () => {
        const store = createStore()
        const objAtom = atom({})
        let derivedAtom: Atom<object> | undefined = atom(get => ({
            obj: get(objAtom),
        }))
        const detector = new LeakDetector(store.get(derivedAtom))
        derivedAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })
})

describe("memory leaks (with subscribe)", () => {
    test("one atom", async () => {
        const store = createStore()
        let objAtom: Atom<object> | undefined = atom({})
        const detector = new LeakDetector(store.get(objAtom))
        let unsub: (() => void) | undefined = store.sub(objAtom, () => {})
        unsub()
        unsub = undefined
        objAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("two atoms", async () => {
        const store = createStore()
        let objAtom: Atom<object> | undefined = atom({})
        const detector1 = new LeakDetector(store.get(objAtom))
        let derivedAtom: Atom<object> | undefined = atom(get => ({
            obj: objAtom && get(objAtom),
        }))
        const detector2 = new LeakDetector(store.get(derivedAtom))
        let unsub: (() => void) | undefined = store.sub(objAtom, () => {})
        unsub()
        unsub = undefined
        objAtom = undefined
        derivedAtom = undefined
        expect(await detector1.isLeaking()).toBe(false)
        expect(await detector2.isLeaking()).toBe(false)
    })

    test("with a long-lived base atom", async () => {
        const store = createStore()
        const objAtom = atom({})
        let derivedAtom: Atom<object> | undefined = atom(get => ({
            obj: get(objAtom),
        }))
        const detector = new LeakDetector(store.get(derivedAtom))
        let unsub: (() => void) | undefined = store.sub(objAtom, () => {})
        unsub()
        unsub = undefined
        derivedAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })
})

describe("memory leaks (with dependencies)", () => {
    test("sync dependency", async () => {
        const store = createStore()
        const baseAtom = atom(1)
        let derivedAtom: Atom<number> | undefined = atom(get => get(baseAtom))
        const detector = new LeakDetector(derivedAtom)
        let unsub: (() => void) | undefined = store.sub(derivedAtom, () => {})
        unsub()
        unsub = undefined
        derivedAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("async dependency", async () => {
        const store = createStore()
        const baseAtom = atom(1)
        let derivedAtom: Atom<Promise<number>> | undefined = atom(
            async get => get(baseAtom),
        )
        const detector = new LeakDetector(derivedAtom)
        let unsub: (() => void) | undefined = store.sub(derivedAtom, () => {})
        unsub()
        unsub = undefined
        derivedAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("async await dependency", async () => {
        const store = createStore()
        const baseAtom = atom(1)
        let derivedAtom: Atom<Promise<number>> | undefined = atom(
            async get => {
                await new Promise(resolve => setTimeout(resolve, 0))
                return get(baseAtom)
            },
        )
        const detector = new LeakDetector(derivedAtom)
        let unsub: (() => void) | undefined = store.sub(derivedAtom, () => {})
        unsub()
        unsub = undefined
        derivedAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })
})
