import { describe, expect, test } from "bun:test"
import { LeakDetector } from "../../test/src/LeakDetector"
import { store } from "../src/store"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { atomFamily } from "../src/atomFamily"
import { selectorFamily } from "../src/selectorFamily"

describe("memory leaks (atoms)", () => {
    test("unreferenced atom value is collected", async () => {
        const store1 = store()
        let atom1: any = atom({})
        const detector = new LeakDetector(store1.get(atom1))
        atom1 = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("atom value is collected after set replaces it", async () => {
        const detector = (() => {
            const s = store()
            const a = atom<object>(undefined as any)
            s.set(a, { original: true })
            const d = new LeakDetector(s.get(a))
            s.set(a, { replaced: true })
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })
})

describe("memory leaks (selectors)", () => {
    test("unreferenced selector value is collected", async () => {
        // IIFE ensures all references (store, atom, selector) truly leave
        // the call stack. Setting variables to undefined is not enough —
        // stateDependents/stateDependencies create a WeakMap ephemeron
        // cycle that JSC may not resolve if bindings linger in scope.
        const detector = (() => {
            const s = store()
            const a = atom(1)
            const sel = selector(get => ({ value: get(a) }))
            return new LeakDetector(s.get(sel))
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("old selector value is collected after dependency changes", async () => {
        const store1 = store()
        const atom1 = atom(1)
        const sel = selector(get => ({ value: get(atom1) }))
        store1.sub(sel, () => {})
        const detector = new LeakDetector(store1.get(sel))
        store1.set(atom1, 2)
        expect(await detector.isLeaking()).toBe(false)
    })

    test("chained selector values are collected", async () => {
        const [detector1, detector2] = (() => {
            const s = store()
            const a = atom(1)
            const sel1 = selector(get => ({ a: get(a) }))
            const sel2 = selector(get => ({ b: get(sel1) }))
            return [
                new LeakDetector(s.get(sel1)),
                new LeakDetector(s.get(sel2)),
            ]
        })()
        expect(await detector1.isLeaking()).toBe(false)
        expect(await detector2.isLeaking()).toBe(false)
    })
})

describe("memory leaks (subscriptions)", () => {
    test("atom value is collected after subscribe and unsubscribe", async () => {
        const store1 = store()
        let atom1: any = atom({})
        const detector = new LeakDetector(store1.get(atom1))
        let unsub: any = store1.sub(atom1, () => {})
        unsub()
        unsub = undefined
        atom1 = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("selector value is collected after subscribe and unsubscribe", async () => {
        const detector = (() => {
            const s = store()
            const a = atom(1)
            const sel = selector(get => ({ value: get(a) }))
            const d = new LeakDetector(s.get(sel))
            const unsub = s.sub(sel, () => {})
            unsub()
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("subscription callback is not retained after unsubscribe", async () => {
        const store1 = store()
        const atom1 = atom(1)
        let callback: any = () => {}
        const detector = new LeakDetector(callback)
        const unsub = store1.sub(atom1, callback)
        callback = undefined
        unsub()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("multiple subscribe/unsubscribe cycles do not leak", async () => {
        const store1 = store()
        const atom1 = atom(1)
        const detectors: LeakDetector[] = []
        for (let i = 0; i < 10; i++) {
            let cb: any = () => {}
            detectors.push(new LeakDetector(cb))
            const unsub = store1.sub(atom1, cb)
            cb = undefined
            unsub()
        }
        for (const detector of detectors) {
            expect(await detector.isLeaking()).toBe(false)
        }
    })
})

describe("memory leaks (atom families)", () => {
    test("released family atom is collected", async () => {
        const store1 = store()
        const family = atomFamily<{ name: string }, [string]>(
            (...args) => ({ name: args[0] }),
        )
        let familyAtom: any = family("alice")
        const detector = new LeakDetector(familyAtom)
        store1.get(familyAtom)
        family.release("alice")
        familyAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("unreleased family atom is retained in map", async () => {
        const family = atomFamily<{ name: string }, [string]>(
            (...args) => ({ name: args[0] }),
        )
        let familyAtom: any = family("bob")
        const detector = new LeakDetector(familyAtom)
        familyAtom = undefined
        // Without release(), the Map holds a reference
        expect(await detector.isLeaking()).toBe(true)
        // Clean up
        family.release("bob")
    })

    test("family atom value is collected after release and unsubscribe", async () => {
        const store1 = store()
        const family = atomFamily<object, [string]>(() => ({}))
        let familyAtom: any = family("charlie")
        const detector = new LeakDetector(store1.get(familyAtom))
        let unsub: any = store1.sub(familyAtom, () => {})
        unsub()
        unsub = undefined
        family.release("charlie")
        familyAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
    })

    test("store.del() releases family atom from family map", async () => {
        const store1 = store()
        const family = atomFamily<object, [number]>(() => ({}))
        store1.set(family(1), { value: 1 })
        // After del(), the family map should no longer hold the entry
        expect(family.__valdresAtomFamilyMap.has(1)).toBe(true)
        store1.del(family(1))
        expect(family.__valdresAtomFamilyMap.has(1)).toBe(false)
    })
})

describe("memory leaks (selector families)", () => {
    test("released selector family entry is collected", async () => {
        const detector = (() => {
            const s = store()
            const baseAtom = atom(1)
            const family = selectorFamily<object, [number]>(
                (...args) =>
                    get => ({ result: get(baseAtom) * args[0] }),
            )
            const sel = family(2)
            const d = new LeakDetector(s.get(sel))
            family.release(2)
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("unreleased selector family entry is retained", async () => {
        const baseAtom = atom(1)
        const family = selectorFamily<object, [number]>(
            (...args) =>
                get => ({ result: get(baseAtom) * args[0] }),
        )
        let sel: any = family(3)
        const detector = new LeakDetector(sel)
        sel = undefined
        expect(await detector.isLeaking()).toBe(true)
        // Clean up
        family.release(3)
    })
})

describe("memory leaks (onMount lifecycle)", () => {
    test("onMount cleanup is not retained after unsubscribe", async () => {
        const store1 = store()
        let cleanupObj: any = { cleaned: false }
        const detector = new LeakDetector(cleanupObj)
        const atom1 = atom(1)
        atom1.onMount = () => {
            const ref = cleanupObj
            return () => {
                ref.cleaned = true
            }
        }
        const unsub = store1.sub(atom1, () => {})
        cleanupObj = undefined
        unsub()
        expect(await detector.isLeaking()).toBe(false)
    })
})

describe("memory leaks (scoped stores)", () => {
    test("scoped atom value is collected after unsubscribe", async () => {
        const store1 = store()
        const atom1 = atom<object>({})
        const scoped = store1.scope("child")
        scoped.set(atom1, { scoped: true })
        const detector = new LeakDetector(scoped.get(atom1))
        let unsub: any = scoped.sub(atom1, () => {})
        unsub()
        unsub = undefined
        scoped.set(atom1, { replaced: true })
        expect(await detector.isLeaking()).toBe(false)
    })

    test("parent releases scope reference after all consumers detach", () => {
        const store1 = store()
        const scoped1: any = store1.scope("shared")
        const scoped2: any = store1.scope("shared")
        // Parent holds the scope
        expect(store1.data.scopes.has("shared")).toBe(true)
        // Detach one consumer — parent still holds scope
        scoped1.detach()
        expect(store1.data.scopes.has("shared")).toBe(true)
        // Detach last consumer — parent drops scope
        scoped2.detach()
        expect(store1.data.scopes.has("shared")).toBe(false)
    })
})

describe("memory leaks (transactions)", () => {
    test("transaction replaces atom value", () => {
        const store1 = store()
        const atom1 = atom<object>({ initial: true })
        const original = store1.get(atom1)
        store1.txn(({ set }) => {
            set(atom1, { txn: true })
        })
        // Verify the store no longer returns the old value
        expect(store1.get(atom1)).not.toBe(original)
        expect(store1.get(atom1)).toStrictEqual({ txn: true })
    })
})
