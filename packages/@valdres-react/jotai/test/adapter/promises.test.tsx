/**
 * Promises stored as atom values, compared with Jotai 3.0.1. These use
 * primitive atoms and synchronous derivations only: storing a promise is
 * separate from tracking dependencies read after an await.
 */
import { act, render } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import * as reference from "jotai-reference"
import { Suspense } from "react"
import * as adapter from "../../src/index"
import { runtimeOf } from "../../src/lib/runtime"
import LeakDetector from "../leakDetector"

type Impl = typeof adapter
const impls = [reference as unknown as Impl, adapter] as const

const deferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const sameAsync = async (scenario: (impl: Impl) => Promise<unknown[]>) => {
    const traces: unknown[][] = []
    for (const impl of impls) {
        traces.push(await scenario(impl))
        document.body.innerHTML = ""
    }
    expect(traces[1]).toEqual(traces[0])
    return traces[0]!
}

// React reveals resolved Suspense boundaries after a throttle (300ms in 19).
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 400)))

describe("store semantics", () => {
    test("pending, resolved and rejected promises keep their identity and do not notify on settle", async () => {
        const trace = await sameAsync(async ({ atom, createStore }) => {
            const store = createStore()
            const pending = deferred<number>()
            const failing = deferred<number>()
            const value = atom<Promise<number>>(pending.promise)
            const passThrough = atom(get => get(value))
            const trace: unknown[] = []
            store.sub(passThrough, () => trace.push("notified"))
            trace.push(store.get(value) === pending.promise)
            pending.resolve(1)
            await pending.promise
            trace.push(store.get(passThrough) === pending.promise)
            store.set(value, failing.promise)
            failing.reject(new Error("rejected"))
            await failing.promise.catch(() => {})
            trace.push(store.get(value) === failing.promise)
            store.set(value, failing.promise)
            return trace
        })
        expect(trace).toEqual([true, true, "notified", true])
    })

    test("a promise returned by a read function is observed, so its rejection is handled", async () => {
        await sameAsync(async ({ atom, createStore }) => {
            const store = createStore()
            const unhandled: unknown[] = []
            const onUnhandled = (reason: unknown) => unhandled.push(reason)
            process.on("unhandledRejection", onUnhandled)
            const failing = atom(() => Promise.reject(new Error("read failed")))
            store.get(failing)
            await new Promise(resolve => setTimeout(resolve, 10))
            process.off("unhandledRejection", onUnhandled)
            return [unhandled.length]
        }).then(trace => expect(trace).toEqual([0]))
    })
})

describe("Suspense", () => {
    test("a stale promise resolving late does not replace the current value", async () => {
        const trace = await sameAsync(
            async ({ atom, createStore, Provider, useAtomValue }) => {
                const store = createStore()
                const first = deferred<string>()
                const second = deferred<string>()
                const value = atom<Promise<string>>(first.promise)
                const View = () => <span>{useAtomValue(value)}</span>
                await act(async () => {
                    render(
                        <Provider store={store}>
                            <Suspense fallback={<span>loading</span>}>
                                <View />
                            </Suspense>
                        </Provider>,
                    )
                })
                const trace: unknown[] = [document.body.textContent]
                await act(async () => store.set(value, second.promise))
                await act(async () => second.resolve("second"))
                await settle()
                trace.push(document.body.textContent)
                await act(async () => first.resolve("first (stale)"))
                await settle()
                trace.push(document.body.textContent)
                return trace
            },
        )
        expect(trace).toEqual(["loading", "second", "second"])
    })

    test("a rejected replacement reaches the boundary; the stale resolution does not", async () => {
        await sameAsync(
            async ({ atom, createStore, Provider, useAtomValue }) => {
                const store = createStore()
                const first = deferred<string>()
                const second = deferred<string>()
                const value = atom<Promise<string>>(first.promise)
                const View = () => <span>{useAtomValue(value)}</span>
                const consoleError = console.error
                console.error = () => {}
                const { Component } = await import("react")
                class Boundary extends Component<
                    { children: unknown },
                    { error?: Error }
                > {
                    override state: { error?: Error } = {}
                    static getDerivedStateFromError(error: Error) {
                        return { error }
                    }
                    override render() {
                        return this.state.error
                            ? `error: ${this.state.error.message}`
                            : (this.props.children as never)
                    }
                }
                try {
                    await act(async () => {
                        render(
                            <Provider store={store}>
                                <Boundary>
                                    <Suspense fallback={<span>loading</span>}>
                                        <View />
                                    </Suspense>
                                </Boundary>
                            </Provider>,
                        )
                    })
                    await act(async () => store.set(value, second.promise))
                    await act(async () =>
                        second.reject(new Error("second failed")),
                    )
                    await settle()
                    await act(async () => first.resolve("first (stale)"))
                    await settle()
                    return [document.body.textContent]
                } finally {
                    console.error = consoleError
                }
            },
        )
    })

    test("unmounting while suspended and remounting later shows the resolved value", async () => {
        await sameAsync(
            async ({ atom, createStore, Provider, useAtomValue }) => {
                const store = createStore()
                const pending = deferred<string>()
                const value = atom<Promise<string>>(pending.promise)
                const View = () => <span>{useAtomValue(value)}</span>
                const tree = (
                    <Provider store={store}>
                        <Suspense fallback={<span>loading</span>}>
                            <View />
                        </Suspense>
                    </Provider>
                )
                let view!: ReturnType<typeof render>
                await act(async () => {
                    view = render(tree)
                })
                const trace: unknown[] = [document.body.textContent]
                view.unmount()
                await act(async () => pending.resolve("resolved"))
                await act(async () => {
                    render(tree)
                })
                await settle()
                trace.push(document.body.textContent)
                return trace
            },
        )
    })
})

describe("cleanup", () => {
    test("waiting for a promise stops observing the store once it settles or is replaced", async () => {
        const store = adapter.createStore()
        const first = deferred<string>()
        const second = deferred<string>()
        const value = adapter.atom<Promise<string>>(first.promise)
        const View = () => <span>{adapter.useAtomValue(value)}</span>
        const watchers = () =>
            (runtimeOf(store) as unknown as { watchers: Set<unknown> }).watchers
                .size
        await act(async () => {
            render(
                <adapter.Provider store={store}>
                    <Suspense fallback={<span>loading</span>}>
                        <View />
                    </Suspense>
                </adapter.Provider>,
            )
        })
        expect(watchers()).toBe(1)
        await act(async () => store.set(value, second.promise))
        expect(watchers()).toBe(1)
        await act(async () => second.resolve("second"))
        await settle()
        expect(document.body.textContent).toBe("second")
        expect(watchers()).toBe(0)
    })

    test("a replaced promise is collectable", async () => {
        const store = adapter.createStore()
        const value = adapter.atom<Promise<object>>(Promise.resolve({}))
        const replace = () => {
            const old = Promise.resolve({ big: new Array(1000).fill(0) })
            store.set(value, old)
            store.get(value)
            return new LeakDetector(old)
        }
        const detector = replace()
        store.set(value, Promise.resolve({}))
        expect(await detector.isLeaking()).toBe(false)
    })
})
