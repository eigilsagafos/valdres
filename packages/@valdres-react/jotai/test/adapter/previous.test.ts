/**
 * Previous computed values for self-reading derived atoms with init (the
 * pattern jotai/utils' selectAtom and splitAtom use), compared with Jotai, and
 * the ownership of the store's previous-result cache.
 */
import { describe, expect, test } from "bun:test"
import * as reference from "jotai-reference/vanilla"
import { selectAtom } from "jotai-reference/vanilla/utils"
import * as adapter from "../../src/index"
import type { AnyAtomConfig } from "../../src/lib/nodeRegistry"
import { runtimeOf } from "../../src/lib/runtime"
import LeakDetector from "../leakDetector"

type Impl = Pick<typeof adapter, "atom" | "createStore">
const impls = [reference as unknown as Impl, adapter] as const
const run = (scenario: (impl: Impl) => unknown[]) => impls.map(scenario)
const same = (scenario: (impl: Impl) => unknown[]) => {
    const [jotai, valdres] = run(scenario)
    expect(valdres).toEqual(jotai)
    return jotai!
}

// A self-reading atom with init, as jotai/utils' selectAtom builds it.
const keepSameId = ({ atom }: Impl, source: unknown) => {
    const EMPTY = Symbol("empty")
    const derived: any = atom(get => {
        const previous = get(derived) as typeof EMPTY | { id: number }
        const next = { id: (get(source as never) as { id: number }).id }
        return previous !== EMPTY && previous.id === next.id ? previous : next
    })
    derived.init = EMPTY
    return derived
}

describe("semantics", () => {
    test("selectAtom keeps the previous slice per store, never across stores", () => {
        same(impl => {
            const { atom, createStore } = impl
            const source = atom({ id: 1, name: "a" })
            const slice: any = selectAtom(
                source as never,
                (v: { id: number }) => ({ id: v.id }),
                (a, b) => a.id === b.id,
            )
            const s1 = createStore()
            const s2 = createStore()
            const s1First = s1.get(slice)
            s2.set(source, { id: 2, name: "x" })
            const s2First = s2.get(slice)
            s1.set(source, { id: 1, name: "b" })
            s2.set(source, { id: 3, name: "y" })
            return [
                s1.get(slice) === s1First,
                s2.get(slice) === s2First,
                s1.get(slice),
                s2.get(slice),
            ]
        })
    })

    test("a mounted self-reading atom keeps identity across equal updates", () => {
        same(impl => {
            const store = impl.createStore()
            const source = impl.atom({ id: 1, name: "a" })
            const derived = keepSameId(impl, source)
            const seen: unknown[] = []
            store.sub(derived, () => seen.push(store.get(derived)))
            const first = store.get(derived)
            store.set(source, { id: 1, name: "b" })
            store.set(source, { id: 2, name: "c" })
            return [
                seen.length,
                store.get(derived) !== first,
                store.get(derived),
            ]
        })
    })

    test("the previous error is rethrown to the self-read, as Jotai's atom state does", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const fail = atom(true)
            const trace: unknown[] = []
            const derived: any = atom(get => {
                try {
                    trace.push(["previous", get(derived)])
                } catch (error) {
                    trace.push(["previous error", (error as Error).message])
                }
                if (get(fail)) throw new Error("failed")
                return "ok"
            })
            derived.init = "init"
            store.sub(derived, () => {})
            store.set(fail, false)
            store.set(fail, true)
            return trace
        })
    })
})

describe("documented differences", () => {
    test("a value read inside a write after a set is not installed (speculative)", () => {
        const [jotai, valdres] = run(impl => {
            const store = impl.createStore()
            const source = impl.atom({ id: 1, name: "a" })
            const derived = keepSameId(impl, source)
            store.sub(derived, () => {})
            let inWrite: unknown
            store.set(
                impl.atom(null, (get, set) => {
                    set(source, { id: 2, name: "b" })
                    inWrite = get(derived)
                }),
            )
            return [inWrite === store.get(derived), inWrite]
        })
        expect(jotai).toEqual([true, { id: 2 }])
        expect(valdres).toEqual([false, { id: 2 }])
    })

    test("eager recomputation of an unsubscribed atom advances its previous value", () => {
        const [jotai, valdres] = run(impl => {
            const store = impl.createStore()
            const source = impl.atom({ id: 1, name: "a" })
            const derived = keepSameId(impl, source)
            const first = store.get(derived)
            store.set(source, { id: 2, name: "b" })
            store.set(source, { id: 1, name: "c" })
            return [store.get(derived) === first]
        })
        expect(jotai).toEqual([true])
        expect(valdres).toEqual([false])
    })

    test("a set(self) to the value already stored is not seen as a write", () => {
        const [jotai, valdres] = run(impl => {
            const store = impl.createStore()
            const source = impl.atom(1)
            const EMPTY = "empty"
            const derived: any = impl.atom(
                get => {
                    const previous = get(derived)
                    return previous === EMPTY
                        ? `fresh ${get(source)}`
                        : `kept ${previous}`
                },
                (_get, set) => set(derived, EMPTY),
            )
            derived.init = EMPTY
            store.sub(derived, () => {})
            store.set(source, 2)
            store.set(derived)
            return [store.get(derived)]
        })
        expect(jotai).toEqual(["empty"])
        expect(valdres).toEqual(["kept fresh 1"])
    })
})

const cachedOutcome = (store: adapter.Store, config: unknown) =>
    runtimeOf(store)!.previousOutcome(config as AnyAtomConfig)

describe("cache ownership", () => {
    test("a write that throws leaves only installed results in the cache", () => {
        const store = adapter.createStore()
        const source = adapter.atom({ id: 1, name: "a" })
        const derived = keepSameId(adapter as Impl, source)
        store.sub(derived, () => {})
        let seenInWrite: unknown
        expect(() =>
            store.set(
                adapter.atom(null, (get, set) => {
                    set(source, { id: 2, name: "b" })
                    seenInWrite = get(derived)
                    throw new Error("aborted")
                }),
            ),
        ).toThrow("aborted")
        const cached = cachedOutcome(store, derived)
        // Jotai keeps the set made before the throw; the staged read was
        // discarded, so the cache holds what the store installed afterwards.
        expect(cached).toMatchObject({ ok: true, value: { id: 2 } })
        expect((cached as { value: unknown }).value).toBe(store.get(derived))
        expect((cached as { value: unknown }).value).not.toBe(seenInWrite)
    })

    test("a staged read inside a write is not retained", async () => {
        const store = adapter.createStore()
        const source = adapter.atom({ id: 1, name: "a" })
        const derived = keepSameId(adapter as Impl, source)
        store.sub(derived, () => {})
        const detector = (() => {
            let staged: unknown
            store.set(
                adapter.atom(null, (get, set) => {
                    set(source, { id: 2, name: "b" })
                    staged = get(derived)
                }),
            )
            return new LeakDetector(staged)
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("each store has its own cache", () => {
        const s1 = adapter.createStore()
        const s2 = adapter.createStore()
        const source = adapter.atom({ id: 1, name: "a" })
        const derived = keepSameId(adapter as Impl, source)
        s1.set(source, { id: 7, name: "x" })
        const first = s1.get(derived)
        expect(cachedOutcome(s2, derived)).toBeUndefined()
        const second = s2.get(derived)
        expect(second).not.toBe(first)
        expect(cachedOutcome(s1, derived)).toMatchObject({ value: first })
        expect(cachedOutcome(s2, derived)).toMatchObject({ value: second })
    })

    test("atoms that never read themselves are not cached", () => {
        const store = adapter.createStore()
        const source = adapter.atom(1)
        const doubled = adapter.atom(get => get(source) * 2)
        store.get(doubled)
        expect(cachedOutcome(store, doubled)).toBeUndefined()
    })
})

describe("retention", () => {
    test("previous values are released with their store", async () => {
        const detector = (() => {
            const store = adapter.createStore()
            const source = adapter.atom({ id: 1, name: "a" })
            const derived = keepSameId(adapter as Impl, source)
            const value = store.get(derived)
            store.set(source, { id: 1, name: "b" })
            return new LeakDetector(value)
        })()
        expect(await detector.isLeaking()).toBe(false)
    })

    test("previous values are released with their atom while the store lives", async () => {
        const store = adapter.createStore()
        const source = adapter.atom({ id: 1, name: "a" })
        const detector = (() => {
            const derived = keepSameId(adapter as Impl, source)
            return new LeakDetector(store.get(derived))
        })()
        store.set(source, { id: 2, name: "b" })
        expect(await detector.isLeaking()).toBe(false)
    })
})
