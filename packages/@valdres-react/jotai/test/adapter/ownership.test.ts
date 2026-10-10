/**
 * Mount ownership: which store's onMount/onUnmount runs, and which store a
 * mount's setAtom writes, when atoms and graphs are shared between stores.
 * Traces are compared with Jotai 3.0.1 in-process.
 */
import { describe, expect, test } from "bun:test"
import * as reference from "jotai-reference/vanilla"
import { atom as valdresAtom, selector, store as valdresStore } from "valdres"
import * as adapter from "../../src/index"
import { getNode } from "../../src/lib/nodes"
import type { AnyAtomConfig } from "../../src/lib/nodeRegistry"

type Impl = Pick<typeof adapter, "atom" | "createStore">
const impls = [reference as unknown as Impl, adapter] as const

const same = (scenario: (impl: Impl) => unknown[]) => {
    const [jotai, valdres] = impls.map(scenario)
    expect(valdres).toEqual(jotai)
    return jotai!
}

const errorsOf = (fn: () => unknown) => {
    try {
        fn()
        return "no error"
    } catch (error) {
        return error instanceof AggregateError
            ? error.errors.map(e => (e as Error).message)
            : (error as Error).message
    }
}

describe("shared graphs across independent stores", () => {
    test("each store mounts, writes and unmounts its own copy", () => {
        const trace = same(({ atom, createStore }) => {
            const trace: unknown[] = []
            const s1 = createStore()
            const s2 = createStore()
            const names = new Map([
                [s1, "s1"],
                [s2, "s2"],
            ])
            const mounts = atom(0)
            mounts.onMount = setMounts => {
                setMounts(n => n + 1)
                trace.push("mount")
                return () => trace.push("unmount")
            }
            const derived = atom(get => get(mounts) * 10)
            const shared = atom(get => get(derived) + 1)
            const u1 = s1.sub(shared, () =>
                trace.push(["s1 listener", s1.get(shared)]),
            )
            const u2 = s2.sub(derived, () =>
                trace.push(["s2 listener", s2.get(derived)]),
            )
            trace.push(["values", s1.get(mounts), s2.get(mounts)])
            u1()
            trace.push(["after s1 unsub", s1.get(mounts), s2.get(mounts)])
            s2.set(mounts, 5)
            u2()
            trace.push([...names.values()])
            return trace
        })
        expect(trace).toContain("unmount")
    })

    test("interleaved operations on two stores stay attributed", () => {
        same(({ atom, createStore }) => {
            const trace: unknown[] = []
            const s1 = createStore()
            const s2 = createStore()
            const inner = atom(0)
            inner.onMount = set => {
                set(n => n + 1)
                return () => trace.push("unmount inner")
            }
            const outer = atom(0)
            // s2's onMount operates on s1: s1 must own inner's mount.
            outer.onMount = () => {
                trace.push("mount outer")
                const unsub = s1.sub(inner, () =>
                    trace.push(["s1 inner", s1.get(inner)]),
                )
                return () => {
                    unsub()
                    trace.push("unmount outer")
                }
            }
            const unsub = s2.sub(outer, () => {})
            trace.push(["inner", s1.get(inner), s2.get(inner)])
            // A listener of s1 subscribes s2.
            let unsubS2: (() => void) | undefined
            s1.sub(inner, () => {
                unsubS2 ??= s2.sub(inner, () =>
                    trace.push(["s2 inner", s2.get(inner)]),
                )
            })
            s1.set(inner, 10)
            trace.push(["inner", s1.get(inner), s2.get(inner)])
            unsub()
            unsubS2?.()
            return trace
        })
    })

    test("a dependency change in one store does not move the other's mounts", () => {
        same(({ atom, createStore }) => {
            const trace: unknown[] = []
            const s1 = createStore()
            const s2 = createStore()
            const label = (name: string) => {
                const a = atom(name)
                a.onMount = () => {
                    trace.push(`mount ${name}`)
                    return () => trace.push(`unmount ${name}`)
                }
                return a
            }
            const left = label("left")
            const right = label("right")
            const useLeft = atom(true)
            const picked = atom(get => (get(useLeft) ? get(left) : get(right)))
            const u1 = s1.sub(picked, () => {})
            const u2 = s2.sub(picked, () => {})
            trace.push("switch s1")
            s1.set(useLeft, false)
            trace.push("unsub s2")
            u2()
            trace.push("unsub s1")
            u1()
            return trace
        })
    })
})

describe("throwing mount callbacks", () => {
    test("a throwing onMount leaves the atom mounted in that store only", () => {
        same(({ atom, createStore }) => {
            const trace: unknown[] = []
            const s1 = createStore()
            const s2 = createStore()
            let fail = true
            const a = atom(0)
            a.onMount = () => {
                trace.push("mount")
                if (fail) throw new Error("mount failed")
                return () => trace.push("unmount")
            }
            let u1: () => void = () => {}
            trace.push(
                errorsOf(
                    () => (u1 = s1.sub(a, () => trace.push("s1 listener"))),
                ),
            )
            s1.set(a, 1)
            fail = false
            const u2 = s2.sub(a, () => trace.push("s2 listener"))
            s2.set(a, 1)
            u1()
            u2()
            trace.push("remount s1")
            s1.sub(a, () => {})()
            return trace
        })
    })

    test("a throwing onUnmount still unmounts", () => {
        same(({ atom, createStore }) => {
            const trace: unknown[] = []
            const store = createStore()
            const a = atom(0)
            a.onMount = () => {
                trace.push("mount")
                return () => {
                    trace.push("unmount")
                    throw new Error("unmount failed")
                }
            }
            const unsub = store.sub(a, () => {})
            trace.push(errorsOf(unsub))
            store.sub(a, () => {})
            return trace
        })
    })
})

describe("reads that must not mount", () => {
    test("reads, scratch reads inside writes and eager recomputation mount nothing", () => {
        same(({ atom, createStore }) => {
            const trace: unknown[] = []
            const store = createStore()
            const base = atom(0)
            base.onMount = () => {
                trace.push("mount base")
            }
            const derived = atom(get => get(base) + 1)
            trace.push(store.get(derived))
            store.set(
                atom(null, (get, set) => {
                    set(base, 1)
                    trace.push(["read in write", get(derived)])
                }),
            )
            store.set(base, 2)
            trace.push(store.get(derived))
            return trace
        })
    })
})

describe("attribution has no fallback", () => {
    test("a mount reached outside a Jotai store operation throws instead of guessing", () => {
        const a = adapter.atom(0)
        a.onMount = () => {}
        const state = getNode(a as unknown as AnyAtomConfig).state
        const foreign = valdresStore()
        const child = foreign.scope("child")
        for (const target of [foreign, child]) {
            let caught: unknown
            try {
                target.sub(state, () => {})
            } catch (error) {
                caught = error
            }
            const causes = (caught as { causes?: unknown[] } | undefined)
                ?.causes ?? [caught]
            expect(
                causes.some(
                    cause =>
                        (cause as { code?: string }).code ===
                        "VALDRES_JOTAI_LIFECYCLE_OUTSIDE_OPERATION",
                ),
            ).toBe(true)
        }
        // The package never creates scopes; a native selector over the state
        // is equally outside any Jotai store.
        const native = selector(get => get(state))
        expect(() => valdresStore().sub(native, () => {})).toThrow()
        void valdresAtom
    })
})
