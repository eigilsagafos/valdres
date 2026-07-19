import { getStoreData } from "../src/lib/getStoreData"
import { describe, expect, test } from "bun:test"
import { LeakDetector } from "../../test/src/LeakDetector"
import { store } from "../src/store"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { atomFamily } from "../src/atomFamily"
import { selectorFamily } from "../src/selectorFamily"
import { familyKey } from "../src/lib/familyKey"
import { index } from "../src/indexConstructor"

// All leak tests that check if a value is collected use an IIFE to ensure
// the store goes fully out of scope before asserting. When bun runs many
// test files in the same process, heap pressure from other files prevents
// WeakMap entries from being cleared by key collection alone — but the
// entries ARE released when the WeakMap (inside the store's data) is itself
// collected. Selector getter closures must be defined in a separate scope
// from the store to avoid JSC scope-capture keeping the store alive.
//
// NOTE: the valdres package test script intentionally runs WITHOUT `--parallel`
// (see package.json). These collection checks depend on JSC actually reclaiming
// a dropped store's object graph; under `bun test --parallel`, the concurrent
// heap pressure from other test files leaves recently-dead allocations pinned by
// JSC's conservative stack scan (see LeakDetector), so the store isn't collected
// in the GC window and these tests flake. A read selector now caches its value
// on the store (so repeated unsubscribed reads are reference-stable — see
// unsubscribedSelectorRefStability.test.ts), which ties that value's lifetime to
// the store's and makes more of these tests sensitive to that pressure. Running
// the suite in a single non-parallel process keeps the heap quiet enough for the
// collection to happen deterministically.

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

describe("memory leaks (global atoms)", () => {
    test("disposed request store is collected while its global atom remains", async () => {
        const globalAtom = atom(0, { global: true })
        const detector = (() => {
            const requestStore = store()
            requestStore.get(globalAtom)
            const detector = new LeakDetector(getStoreData(requestStore))
            requestStore.dispose()
            return detector
        })()

        expect(await detector.isLeaking()).toBe(false)
    })

    test("global store does not retain an otherwise released global atom", async () => {
        const detector = (() => {
            const requestStore = store()
            const globalAtom = atom(0, { global: true })
            requestStore.get(globalAtom)
            const detector = new LeakDetector(globalAtom)
            requestStore.dispose()
            return detector
        })()

        expect(await detector.isLeaking()).toBe(false)
    })
})

describe("memory leaks (selectors)", () => {
    test("cold selector reads do not retain reverse dependency edges", () => {
        const s = store()
        const baseAtom = atom(1)
        const selectorCount = 1_000

        for (let i = 0; i < selectorCount; i++) {
            const coldSelector = selector(get => get(baseAtom) + i)
            expect(s.get(coldSelector)).toBe(i + 1)
        }

        expect(getStoreData(s).stateDependents.get(baseAtom)?.size ?? 0).toBe(0)
    })

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

    test("stateDependents are cleaned up after selector unsubscribe", async () => {
        const s = store()
        const baseAtom = atom(1)
        const sel = selector(get => get(baseAtom) + 1)
        const unsub = s.sub(sel, () => {})
        expect(getStoreData(s).stateDependents.get(baseAtom)?.has(sel)).toBe(
            true,
        )
        unsub()
        await Promise.resolve()
        // After unsubscribe, sel should be removed from baseAtom's dependents
        const after = getStoreData(s).stateDependents.get(baseAtom)
        expect(!after || !after.has(sel)).toBe(true)
    })

    test("a cold read after live teardown does not restore reverse edges", async () => {
        const s = store()
        const baseAtom = atom(1)
        const sel = selector(get => get(baseAtom) + 1)

        const unsubscribe = s.sub(sel, () => {})
        expect(getStoreData(s).stateDependents.get(baseAtom)).toContain(sel)
        unsubscribe()
        await Promise.resolve()

        expect(s.get(sel)).toBe(2)
        expect(
            getStoreData(s).stateDependents.get(baseAtom)?.has(sel) ?? false,
        ).toBe(false)
    })

    test("subscribing to a base atom does not promote its cold selectors", async () => {
        const s = store()
        const baseAtom = atom(1)
        const sel = selector(get => get(baseAtom) + 1)
        // A cold evaluation records only the forward dependency.
        s.get(sel)
        expect(
            getStoreData(s).stateDependents.get(baseAtom)?.has(sel) ?? false,
        ).toBe(false)
        // Subscribe to the base atom, then unsubscribe
        const unsub = s.sub(baseAtom, () => {})
        unsub()
        await Promise.resolve()
        // The unrelated base subscription never inserted the selector.
        const after = getStoreData(s).stateDependents.get(baseAtom)
        expect(!after || !after.has(sel)).toBe(true)
    })

    test("cold selector cache is revision-invalidated without a reverse edge", () => {
        const s = store()
        const baseAtom = atom(1)
        const sel = selector(get => get(baseAtom) + 1)
        expect(s.get(sel)).toBe(2)
        // A cold value stays cached for reference-stable reads. The cache lives
        // behind weak selector keys and has no strong reverse edge, so it does
        // not prevent an otherwise-unreferenced selector from being collected.
        expect(getStoreData(s).values.has(sel)).toBe(true)
        // Subscribe to baseAtom (not sel) so propagation runs on change.
        const unsub = s.sub(baseAtom, () => {})
        s.set(baseAtom, 2)
        // The cached value remains, but no reverse edge made this write visit it.
        // Its dependency revision makes the next read re-evaluate lazily.
        expect(getStoreData(s).values.has(sel)).toBe(true)
        expect(
            getStoreData(s).stateDependents.get(baseAtom)?.has(sel) ?? false,
        ).toBe(false)
        expect(s.get(sel)).toBe(3)
        unsub()
    })

    test("async promise resolution does not repopulate values after cleanup", async () => {
        const s = store()
        const baseAtom = atom(1)
        let resolve!: (v: number) => void
        const sel = selector(get => {
            get(baseAtom)
            return new Promise<number>(r => {
                resolve = r
            })
        })
        // Subscribe triggers evaluation; sel's value is the pending promise
        const unsub = s.sub(sel, () => {})
        expect(getStoreData(s).values.has(sel)).toBe(true)
        // Unsubscribe — cleanup deletes value and deps
        unsub()
        await Promise.resolve()
        expect(getStoreData(s).values.has(sel)).toBe(false)
        expect(getStoreData(s).stateDependencies.has(sel)).toBe(false)
        // Resolve the promise — handler should bail, not repopulate
        resolve(42)
        await Promise.resolve()
        expect(getStoreData(s).values.has(sel)).toBe(false)
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
            // Plain atom teardown deliberately has no orphan-cleanup microtask.
            // After this tight loop, JSC's conservative stack scan can retain a
            // stale callback register under full-suite heap pressure even though
            // the subscription entry is gone. The detector's default bounded
            // window accounts for exactly this post-teardown shape.
            expect(await detector.isLeaking()).toBe(false)
        }
    })
})

describe("memory leaks (atom families)", () => {
    test("store-retained family atom is collected with its store", async () => {
        const detector = (() => {
            let s: any = store()
            let family: any = atomFamily<{ name: string }, [string]>(
                (...args) => ({ name: args[0] }),
            )
            let familyAtom: any = family("alice")
            const d = new LeakDetector(familyAtom)
            s.get(familyAtom)
            // Clear the local owner chain explicitly before returning the
            // detector; JSC's conservative scan can otherwise treat the ended
            // scope's store/index slots as roots for the whole bounded window.
            familyAtom = undefined
            family = undefined
            s = undefined
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("unreferenced family atom is collected from the weak identity cache", async () => {
        const family = atomFamily<{ name: string }, [string]>((...args) => ({
            name: args[0],
        }))
        let familyAtom: any = family("bob")
        const detector = new LeakDetector(familyAtom)
        familyAtom = undefined
        expect(await detector.isLeaking()).toBe(false)
        expect(family.__valdresAtomFamilyMap.has(familyKey(["bob"]))).toBe(
            false,
        )
    })

    test("family atom value is collected after unsubscribe", async () => {
        const detector = (() => {
            const s = store()
            const family = atomFamily<object, [string]>(() => ({}))
            let familyAtom: any = family("charlie")
            const d = new LeakDetector(s.get(familyAtom))
            const unsub = s.sub(familyAtom, () => {})
            unsub()
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("store.del() preserves the shared family identity", () => {
        const store1 = store()
        const family = atomFamily<object, [number]>(() => ({}))
        const member = family(1)
        store1.set(member, { value: 1 })
        expect(family.__valdresAtomFamilyMap.has(1)).toBe(true)
        store1.del(member)
        expect(family(1)).toBe(member)
        expect(family.__valdresAtomFamilyMap.has(1)).toBe(true)
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
        const family = selectorFamily<object, [number]>((...args) => get => ({
            result: get(baseAtom) * args[0],
        }))
        let sel: any = family(3)
        const detector = new LeakDetector(sel)
        sel = undefined
        // A real strong reference does not need the detector's wider
        // dead-object window; keep this intentional-leak assertion fast.
        expect(await detector.isLeaking(10)).toBe(true)
        // Clean up
        family.release(3)
    })
})

describe("memory leaks (indexes)", () => {
    test("unreferenced term selector leaves the weak index cache", async () => {
        const family = atomFamily<{ kind: string }, [string]>(null)
        const byKind = index(
            family,
            (value, kind: string) => value.kind === kind,
        )
        let termSelector: any = byKind("archived")
        const detector = new LeakDetector(termSelector)
        termSelector = undefined

        expect(await detector.isLeaking()).toBe(false)
        expect((byKind as any).map.has(familyKey(["archived"]))).toBe(false)
    })

    test("a live store graph preserves cached term identity", async () => {
        const store1 = store()
        const family = atomFamily<{ kind: string }, [string]>(null)
        const byKind = index(
            family,
            (value, kind: string) => value.kind === kind,
        )
        let termSelector: any = byKind("active")
        const ref = new WeakRef(termSelector)
        const detector = new LeakDetector(termSelector)
        const unsubscribe = store1.sub(termSelector, () => {})
        termSelector = undefined

        expect(await detector.isLeaking(10)).toBe(true)
        expect(byKind("active")).toBe(ref.deref())

        unsubscribe()
        store1.dispose()
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

    test("unset scope value is collected", async () => {
        const detector = (() => {
            const s = store()
            const a = atom<object>({})
            const scoped = s.scope("child")
            scoped.set(a, { scoped: true })
            const d = new LeakDetector(scoped.get(a))
            scoped.unset(a)
            return d
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("parent releases scope reference after all consumers detach", () => {
        const store1 = store()
        const scoped1: any = store1.scope("shared")
        const scoped2: any = store1.scope("shared")
        expect(getStoreData(store1).scopes.has("shared")).toBe(true)
        scoped1.detach()
        expect(getStoreData(store1).scopes.has("shared")).toBe(true)
        scoped2.detach()
        expect(getStoreData(store1).scopes.has("shared")).toBe(false)
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
