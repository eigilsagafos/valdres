import { describe, expect, test } from "bun:test"
import { LeakDetector } from "../../test/src/LeakDetector"
import { store } from "../src/store"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { atomFamily } from "../src/atomFamily"
import { selectorFamily } from "../src/selectorFamily"

// All leak tests that check if a value is collected use an IIFE to ensure
// the store goes fully out of scope before asserting. When bun runs many
// test files in the same process, heap pressure from other files prevents
// WeakMap entries from being cleared by key collection alone — but the
// entries ARE released when the WeakMap (inside the store's data) is itself
// collected. Selector getter closures must be defined in a separate scope
// from the store to avoid JSC scope-capture keeping the store alive.

describe("memory leaks (atoms)", () => {
    test("unreferenced atom value is collected", async () => {
        const detector = (() => {
            const s = store()
            const a = atom({})
            return new LeakDetector(s.get(a))
        })()
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
        const sel = (() => {
            const a = atom(1)
            return selector(get => ({ value: get(a) }))
        })()
        const detector = (() => {
            const s = store()
            return new LeakDetector(s.get(sel))
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("old selector value is collected after dependency changes", async () => {
        const detector = (() => {
            const s = store()
            const a = atom(1)
            const sel = selector(get => ({ value: get(a) }))
            s.sub(sel, () => {})
            const d = new LeakDetector(s.get(sel))
            s.set(a, 2)
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("chained selector values are collected", async () => {
        const { sel1, sel2 } = (() => {
            const a = atom(1)
            const sel1 = selector(get => ({ a: get(a) }))
            const sel2 = selector(get => ({ b: get(sel1) }))
            return { sel1, sel2 }
        })()
        const [detector1, detector2] = (() => {
            const s = store()
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
        const detector = (() => {
            const s = store()
            const a = atom({})
            const d = new LeakDetector(s.get(a))
            const unsub = s.sub(a, () => {})
            unsub()
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("selector value is collected after subscribe and unsubscribe", async () => {
        const sel = (() => {
            const a = atom(1)
            return selector(get => ({ value: get(a) }))
        })()
        const detector = (() => {
            const s = store()
            const d = new LeakDetector(s.get(sel))
            const unsub = s.sub(sel, () => {})
            unsub()
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("derived selector value is collected after base atom unsubscribe", async () => {
        const baseAtom = atom(1)
        const sel = selector(get => ({ value: get(baseAtom) }))
        const detector = (() => {
            const s = store()
            s.get(sel)
            const d = new LeakDetector(s.get(sel))
            const unsub = s.sub(baseAtom, () => {})
            unsub()
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("stateDependents are cleaned up after selector unsubscribe", () => {
        const s = store()
        const baseAtom = atom(1)
        const sel = selector(get => get(baseAtom) + 1)
        const unsub = s.sub(sel, () => {})
        expect(s.data.stateDependents.get(baseAtom)?.has(sel)).toBe(true)
        unsub()
        // After unsubscribe, sel should be removed from baseAtom's dependents
        const after = s.data.stateDependents.get(baseAtom)
        expect(!after || !after.has(sel)).toBe(true)
    })

    test("stateDependents are cleaned up after base atom unsubscribe", () => {
        const s = store()
        const baseAtom = atom(1)
        const sel = selector(get => get(baseAtom) + 1)
        // Evaluate sel so the dep graph is established
        s.get(sel)
        expect(s.data.stateDependents.get(baseAtom)?.has(sel)).toBe(true)
        // Subscribe to the base atom, then unsubscribe
        const unsub = s.sub(baseAtom, () => {})
        unsub()
        // After unsubscribe, sel should be removed from baseAtom's dependents
        const after = s.data.stateDependents.get(baseAtom)
        expect(!after || !after.has(sel)).toBe(true)
    })

    test("invalidated selector value is not retained in store data", () => {
        const s = store()
        const baseAtom = atom(1)
        const sel = selector(get => get(baseAtom) + 1)
        expect(s.get(sel)).toBe(2)
        // After init-time propagation, sel has no subscribers/dependents so
        // its value is removed from data.values to allow GC.
        expect(s.data.values.has(sel)).toBe(false)
        // Subscribe to baseAtom (not sel) so propagation runs on change
        const unsub = s.sub(baseAtom, () => {})
        s.set(baseAtom, 2)
        // Value is still cleared — not stashed in any secondary cache
        expect(s.data.values.has(sel)).toBe(false)
        // Lazy re-evaluation on next read still works
        expect(s.get(sel)).toBe(3)
        unsub()
    })

    test("async promise resolution does not repopulate values after cleanup", async () => {
        const s = store()
        const baseAtom = atom(1)
        let resolve!: (v: number) => void
        const sel = selector(get => {
            get(baseAtom)
            return new Promise<number>(r => { resolve = r })
        })
        // Subscribe triggers evaluation; sel's value is the pending promise
        const unsub = s.sub(sel, () => {})
        expect(s.data.values.has(sel)).toBe(true)
        // Unsubscribe — cleanup deletes value and deps
        unsub()
        expect(s.data.values.has(sel)).toBe(false)
        expect(s.data.stateDependencies.has(sel)).toBe(false)
        // Resolve the promise — handler should bail, not repopulate
        resolve(42)
        await Promise.resolve()
        expect(s.data.values.has(sel)).toBe(false)
    })

    test("subscription callback is not retained after unsubscribe", async () => {
        let callback: any = () => {}
        const detector = new LeakDetector(callback)
        ;(() => {
            const s = store()
            const a = atom(1)
            const unsub = s.sub(a, callback)
            callback = undefined
            unsub()
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("multiple subscribe/unsubscribe cycles do not leak", async () => {
        const detectors: LeakDetector[] = []
        ;(() => {
            const s = store()
            const a = atom(1)
            for (let i = 0; i < 10; i++) {
                let cb: any = () => {}
                detectors.push(new LeakDetector(cb))
                const unsub = s.sub(a, cb)
                cb = undefined
                unsub()
            }
        })()
        for (const detector of detectors) {
            expect(await detector.isLeaking()).toBe(false)
        }
    })
})

describe("memory leaks (atom families)", () => {
    test("released family atom is collected", async () => {
        const detector = (() => {
            const s = store()
            const family = atomFamily<{ name: string }, [string]>(
                (...args) => ({ name: args[0] }),
            )
            let familyAtom: any = family("alice")
            const d = new LeakDetector(familyAtom)
            s.get(familyAtom)
            family.release("alice")
            return d
        })()
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
        const detector = (() => {
            const s = store()
            const family = atomFamily<object, [string]>(() => ({}))
            let familyAtom: any = family("charlie")
            const d = new LeakDetector(s.get(familyAtom))
            const unsub = s.sub(familyAtom, () => {})
            unsub()
            family.release("charlie")
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("store.del() releases family atom from family map", async () => {
        const store1 = store()
        const family = atomFamily<object, [number]>(() => ({}))
        store1.set(family(1), { value: 1 })
        expect(family.__valdresAtomFamilyMap.has(1)).toBe(true)
        store1.del(family(1))
        expect(family.__valdresAtomFamilyMap.has(1)).toBe(false)
    })
})

describe("memory leaks (selector families)", () => {
    test("released selector family entry is collected", async () => {
        const { family, sel } = (() => {
            const baseAtom = atom(1)
            const family = selectorFamily<object, [number]>(
                (...args) =>
                    get => ({ result: get(baseAtom) * args[0] }),
            )
            return { family, sel: family(2) }
        })()
        const detector = (() => {
            const s = store()
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
        let cleanupObj: any = { cleaned: false }
        const detector = new LeakDetector(cleanupObj)
        ;(() => {
            const s = store()
            const a = atom(1)
            a.onMount = () => {
                const ref = cleanupObj
                return () => {
                    ref.cleaned = true
                }
            }
            const unsub = s.sub(a, () => {})
            cleanupObj = undefined
            unsub()
        })()
        expect(await detector.isLeaking()).toBe(false)
    })
})

describe("memory leaks (scoped stores)", () => {
    test("scoped atom value is collected after unsubscribe", async () => {
        const detector = (() => {
            const s = store()
            const a = atom<object>({})
            const scoped = s.scope("child")
            scoped.set(a, { scoped: true })
            const d = new LeakDetector(scoped.get(a))
            const unsub = scoped.sub(a, () => {})
            unsub()
            scoped.set(a, { replaced: true })
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("parent releases scope reference after all consumers detach", () => {
        const store1 = store()
        const scoped1: any = store1.scope("shared")
        const scoped2: any = store1.scope("shared")
        expect(store1.data.scopes.has("shared")).toBe(true)
        scoped1.detach()
        expect(store1.data.scopes.has("shared")).toBe(true)
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
        expect(store1.get(atom1)).not.toBe(original)
        expect(store1.get(atom1)).toStrictEqual({ txn: true })
    })
})
