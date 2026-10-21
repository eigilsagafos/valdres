/**
 * React behavior compared in-process with Jotai 3.0.1's own hooks: the same
 * tree is rendered with each implementation and the traces must match.
 */
import { act, render, screen } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import * as reference from "jotai-reference"
import {
    StrictMode,
    Suspense,
    useEffect,
    useState,
    type ReactNode,
} from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import * as adapter from "../../src/index"

type Impl = typeof adapter
const impls: readonly (readonly [string, Impl])[] = [
    ["jotai", reference as unknown as Impl],
    ["valdres", adapter],
]

// React throttles revealing resolved Suspense boundaries (300ms in React 19).
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 400)))

const both = async (
    scenario: (impl: Impl) => Promise<unknown[]> | unknown[],
) => {
    const traces: unknown[][] = []
    for (const [, impl] of impls) {
        traces.push(await scenario(impl))
        document.body.innerHTML = ""
    }
    expect(traces[1]).toEqual(traces[0])
    return traces[0]!
}

describe("lifecycle", () => {
    test("StrictMode mounts, unmounts and remounts onMount like Jotai", async () => {
        const trace = await both(async ({ atom, useAtom }) => {
            const trace: unknown[] = []
            const count = atom(0)
            count.onMount = setCount => {
                trace.push("mount")
                setCount(c => c + 1)
                return () => trace.push("unmount")
            }
            const Counter = () => {
                const [value, setValue] = useAtom(count)
                trace.push(`render ${value}`)
                return (
                    <button onClick={() => setValue(v => v + 1)}>
                        {value}
                    </button>
                )
            }
            const view = render(
                <StrictMode>
                    <Counter />
                </StrictMode>,
            )
            await act(async () => {})
            await act(async () => screen.getByRole("button").click())
            trace.push(`text ${screen.getByRole("button").textContent}`)
            view.unmount()
            return trace
        })
        expect(trace).toEqual([
            "render 0",
            "render 0",
            "mount",
            "unmount",
            "mount",
            "render 2",
            "render 2",
            "render 3",
            "render 3",
            "text 3",
            "unmount",
        ])
    })

    test("useSetAtom does not mount; useAtomValue does", async () => {
        const trace = await both(async ({ atom, useAtomValue, useSetAtom }) => {
            const trace: unknown[] = []
            const a = atom(0)
            a.onMount = () => {
                trace.push("mount")
                return () => trace.push("unmount")
            }
            const Setter = () => {
                useSetAtom(a)
                return null
            }
            const Reader = () => <span>{useAtomValue(a)}</span>
            const first = render(<Setter />)
            await act(async () => {})
            trace.push("setter only")
            first.unmount()
            const second = render(<Reader />)
            await act(async () => {})
            second.unmount()
            return trace
        })
        expect(trace).toEqual(["setter only", "mount", "unmount"])
    })

    test("a value written by a child's effect during mount is rendered", async () => {
        const trace = await both(async ({ atom, useAtomValue, useSetAtom }) => {
            const a = atom("initial")
            const Child = () => {
                const set = useSetAtom(a)
                useEffect(() => set("from child effect"), [set])
                return null
            }
            const Parent = () => (
                <>
                    <span>{useAtomValue(a)}</span>
                    <Child />
                </>
            )
            render(<Parent />)
            await act(async () => {})
            return [document.body.textContent]
        })
        expect(trace).toEqual(["from child effect"])
    })
})

describe("Provider ownership", () => {
    test("a Provider without a store owns one per instance; with a store it uses it", async () => {
        const trace = await both(
            async ({
                atom,
                createStore,
                getDefaultStore,
                Provider,
                useAtom,
                useStore,
            }) => {
                const count = atom(0)
                const external = createStore()
                external.set(count, 10)
                const stores: unknown[] = []
                const Counter = ({ label }: { label: string }) => {
                    const [value, setValue] = useAtom(count)
                    stores.push(useStore())
                    return (
                        <button
                            onClick={() => setValue(v => v + 1)}
                        >{`${label}:${value}`}</button>
                    )
                }
                render(
                    <>
                        <Counter label="default" />
                        <Provider>
                            <Counter label="owned-a" />
                        </Provider>
                        <Provider>
                            <Counter label="owned-b" />
                        </Provider>
                        <Provider store={external}>
                            <Counter label="external" />
                        </Provider>
                    </>,
                )
                await act(async () => screen.getByText("owned-a:0").click())
                const text = screen
                    .getAllByRole("button")
                    .map(button => button.textContent)
                const [defaultStore, ownedA, ownedB, ext] = stores
                return [
                    text,
                    defaultStore === getDefaultStore(),
                    ownedA !== ownedB && ownedA !== defaultStore,
                    ext === external,
                    external.get(count),
                ]
            },
        )
        expect(trace).toEqual([
            ["default:0", "owned-a:1", "owned-b:0", "external:10"],
            true,
            true,
            true,
            10,
        ])
    })

    test("an owned store survives re-renders of its Provider", async () => {
        const trace = await both(async ({ atom, Provider, useAtom }) => {
            const count = atom(0)
            let rerenderParent = () => {}
            const Counter = () => {
                const [value, setValue] = useAtom(count)
                return (
                    <button onClick={() => setValue(v => v + 1)}>
                        {value}
                    </button>
                )
            }
            const Parent = ({ children }: { children: ReactNode }) => {
                const [, setTick] = useState(0)
                rerenderParent = () => setTick(t => t + 1)
                return <Provider>{children}</Provider>
            }
            render(
                <Parent>
                    <Counter />
                </Parent>,
            )
            await act(async () => screen.getByRole("button").click())
            await act(async () => rerenderParent())
            return [screen.getByRole("button").textContent]
        })
        expect(trace).toEqual(["1"])
    })
})

describe("server rendering and hydration", () => {
    test("server markup hydrates without recoverable errors", async () => {
        const trace = await both(
            async ({ atom, createStore, Provider, useAtom }) => {
                const count = atom(0)
                const label = atom(get => `count ${get(count)}`)
                const App = ({
                    store,
                }: {
                    store: ReturnType<typeof createStore>
                }) => {
                    const Counter = () => {
                        const [text] = useAtom(label)
                        const [, setCount] = useAtom(count)
                        return (
                            <button onClick={() => setCount(c => c + 1)}>
                                {text}
                            </button>
                        )
                    }
                    return (
                        <Provider store={store}>
                            <Counter />
                        </Provider>
                    )
                }
                const serverStore = createStore()
                serverStore.set(count, 3)
                const html = renderToString(<App store={serverStore} />)
                const container = document.createElement("div")
                container.innerHTML = html
                document.body.append(container)
                const clientStore = createStore()
                clientStore.set(count, 3)
                const errors: unknown[] = []
                let root!: ReturnType<typeof hydrateRoot>
                await act(async () => {
                    root = hydrateRoot(container, <App store={clientStore} />, {
                        onRecoverableError: error => errors.push(error),
                    })
                })
                await act(async () =>
                    container.querySelector("button")!.click(),
                )
                const text = container.textContent
                root.unmount()
                return [html, errors.length, text]
            },
        )
        expect(trace).toEqual(["<button>count 3</button>", 0, "count 4"])
    })
})

describe("Suspense", () => {
    test("an async atom suspends and resolves; replacing its promise is followed", async () => {
        const trace = await both(async ({ atom, useAtomValue, useSetAtom }) => {
            const resolvers: ((value: string) => void)[] = []
            const data = atom(
                new Promise<string>(resolve => resolvers.push(resolve)),
            )
            const replace = atom(null, (_get, set, value: string) => {
                set(data, Promise.resolve(value))
            })
            const View = () => <span>{useAtomValue(data)}</span>
            let setReplace: (value: string) => void = () => {}
            const Control = () => {
                setReplace = useSetAtom(replace)
                return null
            }
            await act(async () => {
                render(
                    <>
                        <Control />
                        <Suspense fallback={<span>loading</span>}>
                            <View />
                        </Suspense>
                    </>,
                )
            })
            const trace: unknown[] = [document.body.textContent]
            await act(async () => setReplace("replaced while pending"))
            await settle()
            trace.push(document.body.textContent)
            return trace
        })
        expect(trace).toEqual(["loading", "replaced while pending"])
    })

    test("a rejected async atom reaches an error boundary with the original error", async () => {
        const { Component } = await import("react")
        class Boundary extends Component<
            { children: ReactNode },
            { error?: unknown }
        > {
            override state: { error?: unknown } = {}
            static getDerivedStateFromError(error: unknown) {
                return { error }
            }
            override render() {
                return this.state.error ? (
                    <span>{`error: ${(this.state.error as Error).message}`}</span>
                ) : (
                    this.props.children
                )
            }
        }
        const trace = await both(async ({ atom, useAtomValue }) => {
            const failing = atom(async () => {
                throw new Error("async failure")
            })
            const View = () => <span>{useAtomValue(failing)}</span>
            const consoleError = console.error
            console.error = () => {}
            try {
                await act(async () => {
                    render(
                        <Boundary>
                            <Suspense fallback={<span>loading</span>}>
                                <View />
                            </Suspense>
                        </Boundary>,
                    )
                })
                await settle()
            } finally {
                console.error = consoleError
            }
            return [document.body.textContent]
        })
        expect(trace).toEqual(["error: async failure"])
    })
})
