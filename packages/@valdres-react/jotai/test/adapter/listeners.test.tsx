/**
 * Store listener semantics compared with Jotai 3.0.1 in-process. Each scenario
 * records a trace with both implementations; the traces must be equal.
 */
import { act, render } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import * as reference from "jotai-reference"
import * as adapter from "../../src/index"

type Impl = typeof adapter
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
            ? error.errors.map(
                  e => (e as { code?: string }).code ?? (e as Error).message,
              )
            : (error as Error).message
    }
}

describe("reads", () => {
    test("a listener sees the committed derived object store.get returns", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const base = atom(1)
            let runs = 0
            const boxed = atom(get => (runs++, { value: get(base) }))
            const seen: unknown[] = []
            store.sub(boxed, () => seen.push(store.get(boxed)))
            store.set(base, 2)
            return [seen[0] === store.get(boxed), seen, runs]
        })
    })

    test("a listener reads other atoms' latest values", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const sum = atom(get => get(a) + get(b))
            const seen: unknown[] = []
            store.sub(a, () =>
                seen.push(["a", store.get(a), store.get(b), store.get(sum)]),
            )
            store.set(
                atom(null, (_get, set) => {
                    set(a, 1)
                    set(b, 2)
                }),
            )
            return seen
        })
    })
})

describe("writes", () => {
    test("a listener's write is visible immediately and notifies inside the set", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const source = atom(0)
            const mirror = atom(0)
            const trace: unknown[] = []
            store.sub(source, () => {
                store.set(mirror, store.get(source) * 10)
                trace.push(["after set in listener", store.get(mirror)])
            })
            store.sub(mirror, () => trace.push(["mirror", store.get(mirror)]))
            store.set(source, 4)
            return trace
        })
    })

    test("a write that changes an atom and restores it notifies that atom only", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const doubled = atom(get => get(a) * 2)
            const trace: unknown[] = []
            store.sub(a, () => trace.push("a"))
            store.sub(doubled, () => trace.push("doubled"))
            store.set(
                atom(null, (_get, set) => {
                    set(a, 1)
                    set(a, 0)
                }),
            )
            return trace
        })
    })

    test("one listener on several changed atoms runs once per flush", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            let calls = 0
            const listener = () => calls++
            store.sub(a, listener)
            store.sub(b, listener)
            store.set(
                atom(null, (_get, set) => {
                    set(a, 1)
                    set(b, 1)
                }),
            )
            return [calls]
        })
    })

    test("a listener may write to a different store", () => {
        same(({ atom, createStore }) => {
            const first = createStore()
            const second = createStore()
            const a = atom(0)
            first.sub(a, () => second.set(a, first.get(a) + 100))
            first.set(a, 1)
            return [first.get(a), second.get(a)]
        })
    })
})

describe("subscription changes inside listeners", () => {
    test("subscribe inside a listener mounts immediately and sees later changes", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const trace: unknown[] = []
            b.onMount = () => {
                trace.push("mount b")
                return () => trace.push("unmount b")
            }
            let unsubB: (() => void) | undefined
            store.sub(a, () => {
                if (!unsubB) {
                    unsubB = store.sub(b, () => trace.push(["b", store.get(b)]))
                    trace.push("subscribed b")
                }
            })
            store.set(a, 1)
            store.set(b, 1)
            unsubB!()
            trace.push("unsubscribed b")
            return trace
        })
    })

    test("unsubscribe inside a listener stops it and unmounts", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const trace: unknown[] = []
            a.onMount = () => () => trace.push("unmount a")
            const unsub = store.sub(a, () => {
                trace.push(["a", store.get(a)])
                unsub()
                trace.push("after unsubscribe")
            })
            store.set(a, 1)
            store.set(a, 2)
            return trace
        })
    })
})

describe("errors", () => {
    test("listener errors keep earlier writes and surface as AggregateError", () => {
        same(({ atom, createStore }) => {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const trace: unknown[] = []
            store.sub(a, () => {
                store.set(b, 1)
                throw new Error("listener failed")
            })
            store.sub(a, () => trace.push("second listener"))
            trace.push(
                errorsOf(() => store.set(a, 1)),
                store.get(b),
            )
            return trace
        })
    })
})

describe("React notifications", () => {
    test("one write notifies a component once and renders the final state", async () => {
        const traces: unknown[][] = []
        for (const { atom, createStore, Provider, useAtomValue } of impls) {
            const store = createStore()
            const a = atom(0)
            const b = atom(0)
            const renders: unknown[] = []
            const View = () => {
                renders.push([useAtomValue(a), useAtomValue(b)])
                return null
            }
            render(
                <Provider store={store}>
                    <View />
                </Provider>,
            )
            await act(async () =>
                store.set(
                    atom(null, (_get, set) => {
                        set(a, 1)
                        set(b, 1)
                    }),
                ),
            )
            await act(async () => store.set(a, 1))
            traces.push(renders)
        }
        expect(traces[1]).toEqual(traces[0])
    })
})
