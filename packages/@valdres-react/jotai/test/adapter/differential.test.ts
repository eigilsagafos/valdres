/**
 * Scenarios outside the upstream suite, run in-process against real Jotai
 * 3.0.1 and against this package; each records a trace and the traces must be
 * equal. Known differences are asserted explicitly at the bottom.
 */
import { describe, expect, test } from "bun:test"
import * as reference from "jotai-reference/vanilla"
import * as adapter from "../../src/index"

type Impl = Pick<typeof adapter, "atom" | "createStore">
const impls = { jotai: reference as unknown as Impl, valdres: adapter }

const differential = (name: string, scenario: (impl: Impl) => unknown[]) =>
    test(name, () => {
        const jotai = scenario(impls.jotai)
        const valdres = scenario(impls.valdres)
        expect(valdres).toEqual(jotai)
    })

const differentialAsync = (
    name: string,
    scenario: (impl: Impl) => Promise<unknown[]>,
) =>
    test(name, async () => {
        const jotai = await scenario(impls.jotai)
        const valdres = await scenario(impls.valdres)
        expect(valdres).toEqual(jotai)
    })

const errorOf = (fn: () => unknown) => {
    try {
        fn()
        return "no error"
    } catch (error) {
        return error instanceof AggregateError
            ? ["AggregateError", ...error.errors.map(e => (e as Error).message)]
            : (error as Error).message
    }
}

describe("primitive and derived atoms", () => {
    differential(
        "primitive reads, writes and functional setters",
        ({ atom, createStore }) => {
            const store = createStore()
            const count = atom(1)
            const empty = atom<number>()
            const fn = atom(() => () => "stored function")
            const trace: unknown[] = [store.get(count), store.get(empty)]
            store.set(count, 2)
            store.set(count, c => c * 10)
            store.set(empty, 3)
            trace.push(store.get(count), store.get(empty), typeof store.get(fn))
            return trace
        },
    )

    differential(
        "derived atoms are cached and only notify on Object.is changes",
        ({ atom, createStore }) => {
            const store = createStore()
            const base = atom({ n: 1 })
            let reads = 0
            const parity = atom(get => (reads++, get(base).n % 2))
            const trace: unknown[] = []
            store.sub(parity, () => trace.push("parity changed"))
            store.set(base, { n: 3 })
            store.set(base, { n: 4 })
            trace.push(["reads", reads])
            const same = store.get(base)
            store.set(base, same)
            trace.push(["reads after same", reads])
            return trace
        },
    )

    differential(
        "write-only atoms read null and return write results",
        ({ atom, createStore }) => {
            const store = createStore()
            const count = atom(0)
            const add = atom(null, (get, set, a: number, b: number) => {
                set(count, get(count) + a + b)
                return `added ${a + b}`
            })
            return [store.get(add), store.set(add, 2, 3), store.get(count)]
        },
    )

    differential(
        "atom(initial, write) writes itself through set(self)",
        ({ atom, createStore }) => {
            const store = createStore()
            const clamped = atom(5, (_get, set, next: number) => {
                set(clamped, Math.max(0, Math.min(10, next)))
            })
            const trace: unknown[] = []
            store.sub(clamped, () => trace.push(store.get(clamped)))
            store.set(clamped, 42)
            store.set(clamped, -1)
            return trace
        },
    )

    differential(
        "read errors surface the original thrown value",
        ({ atom, createStore }) => {
            const store = createStore()
            const boom = new Error("boom")
            const fails = atom(() => {
                throw boom
            })
            const dependent = atom(get => get(fails))
            const fallback = atom(get => {
                try {
                    return get(fails)
                } catch (error) {
                    return error === boom ? "caught original" : "caught wrapper"
                }
            })
            const thrown: unknown[] = []
            for (const target of [fails, dependent]) {
                try {
                    store.get(target)
                } catch (error) {
                    thrown.push(error === boom)
                }
            }
            return [...thrown, store.get(fallback)]
        },
    )

    differential(
        "read-only and self-without-init writes throw",
        ({ atom, createStore }) => {
            const store = createStore()
            const derived = atom(() => 1)
            const selfWriter: adapter.WritableAtom<number, [], void> = atom(
                () => 1,
                (_get, set) => set(selfWriter as never, 2),
            )
            return [
                errorOf(() => store.set(derived as never)),
                errorOf(() => store.set(selfWriter)),
            ].map(message =>
                typeof message === "string" ? message.length > 0 : message,
            )
        },
    )
})

describe("writes", () => {
    differential(
        "listeners see a write's sets once, after the write",
        ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const sum = atom(get => get(a) + get(b))
            const trace: unknown[] = []
            store.sub(sum, () => trace.push(["sum", store.get(sum)]))
            store.sub(a, () => trace.push(["a", store.get(a)]))
            const both = atom(null, (get, set) => {
                set(a, 1)
                trace.push(["in write", get(sum)])
                set(b, 2)
                trace.push(["in write", get(sum)])
                return "done"
            })
            trace.push(store.set(both))
            return trace
        },
    )

    differential(
        "nested writes share the outer write's batch",
        ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const incA = atom(null, (get, set) => set(a, get(a) + 1))
            const twice = atom(null, (get, set) => {
                set(incA)
                set(incA)
                return get(a)
            })
            const trace: unknown[] = []
            store.sub(a, () => trace.push(["a", store.get(a)]))
            trace.push(store.set(twice))
            return trace
        },
    )

    differential(
        "a throwing write keeps the sets before the throw",
        ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const failing = atom(null, (_get, set) => {
                set(a, 1)
                throw new Error("write failed")
            })
            const trace: unknown[] = []
            store.sub(a, () => trace.push(["a", store.get(a)]))
            trace.push(
                errorOf(() => store.set(failing)),
                store.get(a),
            )
            return trace
        },
    )

    differential(
        "store.set inside a write flushes the earlier sets first",
        ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const trace: unknown[] = []
            store.sub(a, () => trace.push(["a", store.get(a), store.get(b)]))
            store.sub(b, () => trace.push(["b", store.get(a), store.get(b)]))
            const outer = atom(null, (_get, set) => {
                set(a, 1)
                store.set(b, 1)
                set(a, 2)
            })
            store.set(outer)
            return trace
        },
    )

    differentialAsync(
        "async writes return their promise and apply later sets individually",
        async ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const trace: unknown[] = []
            store.sub(a, () => trace.push(["a", store.get(a)]))
            store.sub(b, () => trace.push(["b", store.get(b)]))
            const load = atom(null, async (get, set, value: number) => {
                set(a, value)
                await Promise.resolve()
                set(b, get(a) * 2)
                set(a, 0)
                return "loaded"
            })
            const pending = store.set(load, 5)
            trace.push(["returned promise", pending instanceof Promise])
            trace.push(await pending)
            return trace
        },
    )
})

describe("listeners", () => {
    differential(
        "a listener can write synchronously and read its own write",
        ({ atom, createStore }) => {
            const store = createStore()
            const source = atom(0)
            const mirror = atom(0)
            const trace: unknown[] = []
            store.sub(source, () => {
                const result = store.set(
                    atom(null, (get, set) => {
                        set(mirror, get(source) * 10)
                        return "written"
                    }),
                )
                trace.push(["listener reads", result, store.get(mirror)])
            })
            store.set(source, 4)
            trace.push(["after", store.get(mirror)])
            return trace
        },
    )

    differential(
        "throwing listeners do not stop others and rethrow as AggregateError",
        ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const trace: unknown[] = []
            store.sub(a, () => {
                throw new Error("first")
            })
            store.sub(a, () => trace.push("second ran"))
            store.sub(a, () => {
                throw new Error("third")
            })
            trace.push(
                errorOf(() => store.set(a, 1)),
                store.get(a),
            )
            return trace
        },
    )

    differential(
        "subscribing and unsubscribing inside a listener",
        ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const trace: unknown[] = []
            let unsubB: (() => void) | undefined
            const unsubA = store.sub(a, () => {
                trace.push(["a", store.get(a)])
                if (!unsubB)
                    unsubB = store.sub(b, () => trace.push(["b", store.get(b)]))
                if (store.get(a) === 2) unsubA()
            })
            store.set(a, 1)
            store.set(b, 1)
            store.set(a, 2)
            store.set(a, 3)
            unsubB?.()
            store.set(b, 2)
            return trace
        },
    )

    differential(
        "unsubscribe is idempotent and per listener",
        ({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const trace: unknown[] = []
            const listener = () => trace.push(store.get(a))
            const u1 = store.sub(a, listener)
            const u2 = store.sub(a, () => trace.push("other"))
            u1()
            u1()
            store.set(a, 1)
            u2()
            store.set(a, 2)
            return trace
        },
    )
})

describe("onMount", () => {
    differential(
        "mount and unmount follow subscriptions, directly and through dependents",
        ({ atom, createStore }) => {
            const store = createStore()
            const trace: unknown[] = []
            const base = atom(0)
            base.onMount = setAtom => {
                trace.push("mount base")
                setAtom(1)
                return () => trace.push("unmount base")
            }
            const derived = atom(get => get(base) * 2)
            const u1 = store.sub(derived, () =>
                trace.push(["derived", store.get(derived)]),
            )
            trace.push(["after sub", store.get(derived)])
            const u2 = store.sub(base, () => {})
            u1()
            trace.push("u1")
            u2()
            trace.push("u2")
            return trace
        },
    )

    differential(
        "setAtom inside onMount is applied after onMount returns",
        ({ atom, createStore }) => {
            const store = createStore()
            const trace: unknown[] = []
            const a = atom(0)
            const b = atom(0)
            const both = atom(null, (_get, set, value: number) => {
                set(a, value)
                set(b, value)
            })
            both.onMount = setAtom => {
                setAtom(1)
                trace.push(["in onMount", store.get(a)])
                setAtom(2)
            }
            store.sub(a, () => trace.push(["a", store.get(a), store.get(b)]))
            store.sub(both, () => {})
            trace.push(["after", store.get(a), store.get(b)])
            return trace
        },
    )

    differential(
        "dynamic dependencies mount and unmount",
        ({ atom, createStore }) => {
            const store = createStore()
            const trace: unknown[] = []
            const left = atom("L")
            left.onMount = () => (
                trace.push("mount L"), () => trace.push("unmount L")
            )
            const right = atom("R")
            right.onMount = () => (
                trace.push("mount R"), () => trace.push("unmount R")
            )
            const useLeft = atom(true)
            const picked = atom(get => (get(useLeft) ? get(left) : get(right)))
            const unsub = store.sub(picked, () =>
                trace.push(["picked", store.get(picked)]),
            )
            store.set(useLeft, false)
            store.set(useLeft, true)
            unsub()
            return trace
        },
    )

    differential(
        "onMount errors are collected and the atom stays mounted",
        ({ atom, createStore }) => {
            const store = createStore()
            const trace: unknown[] = []
            const a = atom(0)
            a.onMount = () => {
                throw new Error("mount failed")
            }
            trace.push(
                errorOf(() =>
                    store.sub(a, () => trace.push(["a", store.get(a)])),
                ),
            )
            store.set(a, 1)
            return trace
        },
    )
})

describe("promises as values", () => {
    differential(
        "promise identity is preserved and drives change detection",
        ({ atom, createStore }) => {
            const store = createStore()
            const first = Promise.resolve(1)
            const second = Promise.resolve(2)
            const value = atom<Promise<number>>(first)
            const passThrough = atom(get => get(value))
            const trace: unknown[] = []
            store.sub(passThrough, () => trace.push("changed"))
            trace.push(
                store.get(value) === first,
                store.get(passThrough) === first,
            )
            store.set(value, first)
            store.set(value, second)
            trace.push(store.get(passThrough) === second)
            return trace
        },
    )

    differentialAsync(
        "async read functions with synchronous gets",
        async ({ atom, createStore }) => {
            const store = createStore()
            const id = atom(1)
            const user = atom(async get => {
                const current = get(id)
                await Promise.resolve()
                return { id: current }
            })
            const name = atom(async get => `user ${(await get(user)).id}`)
            const trace: unknown[] = [await store.get(name)]
            const stable = store.get(name)
            trace.push(stable === store.get(name))
            store.set(id, 2)
            trace.push(stable === store.get(name), await store.get(name))
            return trace
        },
    )
})

describe("documented differences", () => {
    test("a derived object read inside a write is recomputed for the store after a set", () => {
        for (const [impl, sameIdentity] of [
            [impls.jotai, true],
            [impls.valdres, false],
        ] as const) {
            const store = impl.createStore()
            const a = impl.atom(1)
            const boxed = impl.atom(get => ({ value: get(a) }))
            store.sub(boxed, () => {})
            let seen: unknown
            store.set(
                impl.atom(null, (get, set) => {
                    set(a, 2)
                    seen = get(boxed)
                }),
            )
            expect(seen === store.get(boxed)).toBe(sameIdentity)
            expect(seen).toEqual(store.get(boxed))
        }
    })
})
