import { describe, expect, test } from "bun:test"
// import { atom, createStore } from "jotai/vanilla"
// import type { Atom } from "jotai/vanilla"

import { promisify } from "util"
import { isPrimitive } from "jest-get-type"
import { format as prettyFormat } from "pretty-format"
import { generateHeapSnapshot } from "bun"
import { createStore } from "../../src/createStore"
import { atom } from "../../src/atom"

const tick = promisify(setImmediate)

export default class LeakDetector {
    private _isReferenceBeingHeld: boolean
    private readonly _finalizationRegistry?: FinalizationRegistry<undefined>

    constructor(value: unknown) {
        if (isPrimitive(value)) {
            throw new TypeError(
                [
                    "Primitives cannot leak memory.",
                    `You passed a ${typeof value}: <${prettyFormat(value)}>`,
                ].join(" "),
            )
        }

        // When `_finalizationRegistry` is GCed the callback we set will no longer be called,
        this._finalizationRegistry = new FinalizationRegistry(() => {
            this._isReferenceBeingHeld = false
        })
        this._finalizationRegistry.register(value as object, undefined)

        this._isReferenceBeingHeld = true

        // Ensure value is not leaked by the closure created by the "weak" callback.
        value = null
    }

    async isLeaking(): Promise<boolean> {
        this._runGarbageCollector()

        // wait some ticks to allow GC to run properly, see https://github.com/nodejs/node/issues/34636#issuecomment-669366235
        for (let i = 0; i < 10; i++) {
            await tick()
        }

        if (this._isReferenceBeingHeld) {
            // triggering a heap snapshot is more aggressive than just `global.gc()`,
            // but it's also quite slow, so only do it if we still think we're leaking.
            // https://github.com/nodejs/node/pull/48510#issuecomment-1719289759
            generateHeapSnapshot()

            for (let i = 0; i < 10; i++) {
                await tick()
            }
        }

        return this._isReferenceBeingHeld
    }

    private _runGarbageCollector() {
        Bun.gc(true)
    }
}

describe("test memory leaks (get & set only)", () => {
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
        async () => {
            const store = createStore()
            const objAtom = atom({})
            let depAtom: Atom<unknown> | undefined = atom(get => get(objAtom))
            const detector = new LeakDetector(depAtom)
            store.get(depAtom)
            depAtom = undefined
            await expect(detector.isLeaking()).resolves.toBe(false)
        },
    )

    test.todo("with a long-lived base atom", async () => {
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

describe("test memory leaks (with subscribe)", () => {
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
