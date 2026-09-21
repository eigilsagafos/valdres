import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { act, cleanup, render, renderHook } from "@testing-library/react"
import { Component, StrictMode, Suspense, type ReactNode } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToReadableStream, renderToString } from "react-dom/server"
import {
    atom,
    externalAtom,
    selector,
    store,
    CallbackCapabilityError,
    InvalidSynchronousExternalSnapshotError,
    ServerSnapshotUnavailableError,
    StoreDisposedError,
    type State,
    type Store,
} from "valdres"
import { createInspectableStore } from "valdres/inspect"
import { Provider } from "../src/Provider"
import { useValue } from "../src/useValue"
import { createInspectableReact } from "../src/inspect"

afterEach(cleanup)

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const probe = <Value,>(initialLive: Value, initialServer: Value) => {
    let live = initialLive
    let server = initialServer
    const listeners = new Set<() => void>()
    const invalidators: (() => void)[] = []
    const counts = {
        live: 0,
        server: 0,
        subscribe: 0,
        cleanup: 0,
        maxActive: 0,
    }
    const state = externalAtom(
        {
            getSnapshot() {
                counts.live++
                return live
            },
            getServerSnapshot() {
                counts.server++
                return server
            },
            subscribe(invalidate) {
                counts.subscribe++
                listeners.add(invalidate)
                invalidators.push(invalidate)
                counts.maxActive = Math.max(counts.maxActive, listeners.size)
                return () => {
                    counts.cleanup++
                    listeners.delete(invalidate)
                }
            },
        },
        { name: "react-external" },
    )
    return {
        state,
        counts,
        listeners,
        invalidators,
        server(value: Value) {
            server = value
        },
        publish(value: Value) {
            live = value
            for (const invalidate of [...listeners]) invalidate()
        },
    }
}

const binding = (mode: "ordinary" | "inspect") => {
    const core = mode === "inspect" ? createInspectableStore() : undefined
    const inspected =
        core === undefined ? undefined : createInspectableReact(core)
    const target = core?.store ?? store()
    const read = inspected?.useValue ?? useValue
    const Boundary = ({
        children,
        selected = target,
    }: {
        children: ReactNode
        selected?: Store
    }) =>
        inspected === undefined ? (
            <Provider store={selected}>{children}</Provider>
        ) : (
            <inspected.Provider store={selected}>{children}</inspected.Provider>
        )
    return { target, read, Boundary, inspected }
}

class ErrorBoundary extends Component<
    { children: ReactNode; caught: (error: unknown) => void },
    { error: unknown }
> {
    state: { error: unknown } = { error: undefined }
    static getDerivedStateFromError(error: unknown) {
        return { error }
    }
    componentDidCatch(error: unknown) {
        this.props.caught(error)
    }
    render() {
        return this.state.error === undefined ? (
            this.props.children
        ) : (
            <span>caught-error</span>
        )
    }
}

for (const mode of ["ordinary", "inspect"] as const) {
    describe(`ExternalAtom React ${mode} bindings`, () => {
        test("SSR uses each reached server source once and attaches nothing", () => {
            const b = binding(mode)
            const p = probe(90, 4)
            let leafReads = 0
            const leaf = selector(get => {
                leafReads++
                return get(p.state) + get(p.state)
            })
            const target = selector(get => get(leaf) + get(leaf))
            const View = () => <span>{b.read(target)}</span>
            expect(
                renderToString(
                    <b.Boundary>
                        <View />
                    </b.Boundary>,
                ),
            ).toContain(">16</span>")
            expect(leafReads).toBe(1)
            expect(p.counts).toEqual({
                live: 0,
                server: 1,
                subscribe: 0,
                cleanup: 0,
                maxActive: 0,
            })
            expect(p.listeners.size).toBe(0)
            b.target.dispose()
        })

        test("hydrates the server value before switching to the live value", async () => {
            const b = binding(mode)
            const p = probe({ value: 9 }, { value: 4 })
            const rendered: number[] = []
            const View = () => {
                const value = b.read(p.state)
                rendered.push(value.value)
                return <span>{value.value}</span>
            }
            const tree = (
                <b.Boundary>
                    <View />
                </b.Boundary>
            )
            const container = document.createElement("div")
            container.innerHTML = renderToString(tree)
            document.body.append(container)
            expect(container.textContent).toBe("4")
            rendered.length = 0
            const recoverable: unknown[] = []
            let root: Root | undefined
            try {
                await act(async () => {
                    root = hydrateRoot(container, tree, {
                        onRecoverableError: error => recoverable.push(error),
                    })
                })
                expect(recoverable).toEqual([])
                expect(rendered[0]).toBe(4)
                expect(rendered.at(-1)).toBe(9)
                expect(container.textContent).toBe("9")
                // SSR and this client hook generation each own one disposable host.
                expect(p.counts.server).toBe(2)
                expect(p.listeners.size).toBe(1)
                act(() => p.publish({ value: 12 }))
                expect(container.textContent).toBe("12")
                expect(p.counts.server).toBe(2)
            } finally {
                if (root !== undefined) await act(async () => root!.unmount())
                container.remove()
                b.target.dispose()
            }
            expect(p.listeners.size).toBe(0)
            expect(p.counts.cleanup).toBe(p.counts.subscribe)
        })

        test("dynamic server branches use server state and preserve the missing-reader path", () => {
            const b = binding(mode)
            const choose = probe(false, true)
            let liveReads = 0
            const missing = externalAtom({
                getSnapshot() {
                    liveReads++
                    return 7
                },
                subscribe() {
                    throw new Error("SSR must not subscribe")
                },
            })
            const branch = selector(get => {
                if (!get(choose.state)) return 0
                try {
                    return get(missing)
                } catch {
                    return -1
                }
            })
            const target = selector(get => get(branch))
            const View = () => <span>{b.read(target)}</span>
            const error = thrownBy(() =>
                renderToString(
                    <b.Boundary>
                        <View />
                    </b.Boundary>,
                ),
            )
            expect(error).toBeInstanceOf(ServerSnapshotUnavailableError)
            expect(
                (error as ServerSnapshotUnavailableError).dependencyPath,
            ).toEqual([target, branch, missing])
            expect(
                Object.isFrozen(
                    (error as ServerSnapshotUnavailableError).dependencyPath,
                ),
            ).toBe(true)
            expect(liveReads).toBe(0)
            expect(choose.counts.server).toBe(1)
            expect(choose.counts.live).toBe(0)
            expect(choose.counts.subscribe).toBe(0)
            b.target.dispose()
        })

        test("borrowed selector reads remain sticky control faults during SSR", () => {
            const b = binding(mode)
            const local = atom(3)
            let supplied!: (state: State<number>) => number
            let caught: unknown
            const source = externalAtom({
                getSnapshot: () => 1,
                getServerSnapshot() {
                    try {
                        supplied(local)
                    } catch (error) {
                        caught = error
                    }
                    return 2
                },
                subscribe() {
                    throw new Error("SSR must not subscribe")
                },
            })
            const target = selector(get => {
                supplied = get
                try {
                    return get(source)
                } catch {
                    return -1
                }
            })
            const View = () => <span>{b.read(target)}</span>
            const error = thrownBy(() =>
                renderToString(
                    <b.Boundary>
                        <View />
                    </b.Boundary>,
                ),
            )
            expect(error).toBe(caught)
            expect(error).toBeInstanceOf(CallbackCapabilityError)
            expect(b.target.get(target)).toBe(1)
            expect(b.target.get(local)).toBe(3)
            b.target.dispose()
        })

        test("server exceptions preserve identity without reading live state", () => {
            const b = binding(mode)
            const expected = new Error("private-server-error")
            let calls = 0
            const source = externalAtom({
                getSnapshot() {
                    throw new Error("must not read live")
                },
                getServerSnapshot() {
                    calls++
                    throw expected
                },
                subscribe() {
                    throw new Error("must not subscribe")
                },
            })
            const View = () => <span>{b.read(source)}</span>
            expect(
                thrownBy(() =>
                    renderToString(
                        <b.Boundary>
                            <View />
                        </b.Boundary>,
                    ),
                ),
            ).toBe(expected)
            expect(calls).toBe(1)
            if (b.inspected !== undefined)
                expect(
                    JSON.stringify(b.inspected.inspect.export()),
                ).not.toContain(expected.message)
            b.target.dispose()
        })

        for (const completion of ["returned", "thrown"] as const) {
            test(`${completion} server thenables become synchronous errors`, () => {
                const b = binding(mode)
                let contained = 0
                const thenable = {
                    then(_resolve: unknown, reject: unknown) {
                        expect(typeof reject).toBe("function")
                        contained++
                    },
                }
                const source = externalAtom({
                    getSnapshot: () => 0,
                    getServerSnapshot: () => {
                        if (completion === "thrown") throw thenable
                        return thenable as unknown as number
                    },
                    subscribe() {
                        throw new Error("must not subscribe")
                    },
                })
                const View = () => <span>{b.read(source)}</span>
                const error = thrownBy(() =>
                    renderToString(
                        <b.Boundary>
                            <View />
                        </b.Boundary>,
                    ),
                )
                expect(error).toBeInstanceOf(
                    InvalidSynchronousExternalSnapshotError,
                )
                expect(error).not.toBe(thenable)
                expect(contained).toBe(1)
                b.target.dispose()
            })
        }

        for (const completion of ["returned", "thrown"] as const) {
            test(`${completion} live thenables reach an error boundary instead of suspending`, () => {
                const b = binding(mode)
                const caught: unknown[] = []
                let samples = 0
                let contained = 0
                let subscriptions = 0
                const thenable = {
                    then() {
                        contained++
                    },
                }
                const source = externalAtom({
                    getSnapshot() {
                        samples++
                        if (completion === "thrown") throw thenable
                        return thenable as unknown as number
                    },
                    subscribe() {
                        subscriptions++
                        return () => undefined
                    },
                })
                const View = () => <span>{b.read(source)}</span>
                const consoleError = spyOn(console, "error").mockImplementation(
                    () => undefined,
                )
                try {
                    const view = render(
                        <b.Boundary>
                            <ErrorBoundary caught={error => caught.push(error)}>
                                <Suspense fallback={<span>suspended</span>}>
                                    <View />
                                </Suspense>
                            </ErrorBoundary>
                        </b.Boundary>,
                    )
                    expect(view.getByText("caught-error")).toBeTruthy()
                    expect(view.queryByText("suspended")).toBeNull()
                    expect(caught.length).toBeGreaterThan(0)
                    expect(
                        caught.every(
                            error =>
                                error instanceof
                                InvalidSynchronousExternalSnapshotError,
                        ),
                    ).toBe(true)
                    expect(contained).toBe(samples)
                    expect(subscriptions).toBe(0)
                } finally {
                    consoleError.mockRestore()
                    b.target.dispose()
                }
            })
        }

        test("StrictMode repeats attachment without leaking or using stale invalidators", () => {
            const b = binding(mode)
            const p = probe(1, 0)
            const View = () => (
                <span>
                    {b.read(p.state)}:{b.read(p.state)}
                </span>
            )
            const view = render(
                <StrictMode>
                    <b.Boundary>
                        <View />
                    </b.Boundary>
                </StrictMode>,
            )
            expect(view.getByText("1:1")).toBeTruthy()
            expect(p.counts.subscribe).toBeGreaterThanOrEqual(2)
            expect(p.counts.maxActive).toBe(1)
            expect(p.listeners.size).toBe(1)
            const samples = p.counts.live
            p.invalidators[0]!()
            expect(p.counts.live).toBe(samples)
            act(() => p.publish(5))
            expect(view.getByText("5:5")).toBeTruthy()
            view.unmount()
            expect(p.listeners.size).toBe(0)
            expect(p.counts.cleanup).toBe(p.counts.subscribe)
            b.target.dispose()
        })

        test("changing State and Store releases old subscriptions and reads the new scope", () => {
            const b = binding(mode)
            const first = probe(2, 20)
            const second = probe(3, 30)
            const offset = atom(0)
            const left = selector(get => get(offset) + get(first.state))
            const right = selector(get => get(offset) + get(second.state))
            const child = b.target.scope()
            child.set(offset, 100)
            const view = renderHook(
                ({
                    state,
                    selected,
                }: {
                    state: State<number>
                    selected: Store
                }) => b.read(state, selected),
                {
                    initialProps: { state: left, selected: b.target },
                    wrapper: ({ children }) => (
                        <b.Boundary>{children}</b.Boundary>
                    ),
                },
            )
            expect(view.result.current).toBe(2)
            view.rerender({ state: right, selected: child })
            expect(view.result.current).toBe(103)
            expect(first.listeners.size).toBe(0)
            expect(second.listeners.size).toBe(1)
            act(() => first.publish(50))
            expect(view.result.current).toBe(103)
            act(() => second.publish(4))
            expect(view.result.current).toBe(104)
            view.rerender({ state: right, selected: b.target })
            expect(view.result.current).toBe(4)
            view.unmount()
            expect(second.listeners.size).toBe(0)
            expect(first.counts.cleanup).toBe(first.counts.subscribe)
            expect(second.counts.cleanup).toBe(second.counts.subscribe)
            b.target.dispose()
        })

        test("disposing a borrowed Store cleans up once and wins on the next read", () => {
            const b = binding(mode)
            const p = probe(3, 0)
            const view = renderHook(() => b.read(p.state), {
                wrapper: ({ children }) => <b.Boundary>{children}</b.Boundary>,
            })
            const stale = p.invalidators.at(-1)!
            expect(p.listeners.size).toBe(1)
            b.target.dispose()
            expect(p.listeners.size).toBe(0)
            expect(p.counts.cleanup).toBe(1)
            const samples = p.counts.live
            stale()
            expect(p.counts.live).toBe(samples)
            expect(thrownBy(() => b.target.get(p.state))).toBeInstanceOf(
                StoreDisposedError,
            )
            view.unmount()
            expect(p.counts.cleanup).toBe(1)
        })

        test("an abandoned suspended render never acquires external lifecycle", () => {
            const b = binding(mode)
            const p = probe(3, 0)
            const never = new Promise<never>(() => {})
            const Abandoned = (): ReactNode => {
                b.read(p.state)
                throw never
            }
            const view = render(
                <b.Boundary>
                    <Suspense fallback={<span>pending</span>}>
                        <Abandoned />
                    </Suspense>
                </b.Boundary>,
            )
            expect(view.getByText("pending")).toBeTruthy()
            expect(p.counts.live).toBeGreaterThan(0)
            expect(p.counts.subscribe).toBe(0)
            view.rerender(
                <b.Boundary>
                    <span>replacement</span>
                </b.Boundary>,
            )
            expect(view.getByText("replacement")).toBeTruthy()
            expect(p.counts.subscribe).toBe(0)
            expect(p.counts.cleanup).toBe(0)
            b.target.dispose()
        })

        test("streamed boundaries observe stable request data without live lifecycle", async () => {
            const b = binding(mode)
            const p = probe(999, 40)
            const local = atom(2)
            const target = selector(get => get(local) + get(p.state))
            let ready = false
            let release!: () => void
            const pending = new Promise<void>(resolve => {
                release = resolve
            })
            const View = ({ delayed = false }: { delayed?: boolean }) => {
                if (delayed && !ready) throw pending
                return <span>{b.read(target, b.target)}</span>
            }
            const errors: unknown[] = []
            const stream = await renderToReadableStream(
                <html>
                    <body>
                        <View />
                        <Suspense fallback={<span>waiting</span>}>
                            <View delayed />
                        </Suspense>
                    </body>
                </html>,
                {
                    onError: error => {
                        errors.push(error)
                    },
                },
            )
            const reader = stream.getReader()
            const decoder = new TextDecoder()
            try {
                const shell = await reader.read()
                let html = decoder.decode(shell.value)
                expect(html).toContain(">42</span>")
                expect(html).toContain("waiting")
                // The owner keeps the request Store and server snapshot fixed
                // while delayed boundaries complete; each hook owns its host.
                ready = true
                release()
                while (true) {
                    const chunk = await reader.read()
                    if (chunk.done) break
                    html += decoder.decode(chunk.value)
                }
                expect(html.match(/>42<\/span>/g)).toHaveLength(2)
                expect(errors).toEqual([])
                expect(p.counts.server).toBe(2)
                expect(p.counts.live).toBe(0)
                expect(p.counts.subscribe).toBe(0)
                expect(p.counts.cleanup).toBe(0)
            } finally {
                await reader.cancel()
                b.target.dispose()
            }
        })

        test("independent SSR requests keep local Atom state and fresh server observations", () => {
            const first = binding(mode)
            const second = binding(mode)
            const p = probe(999, 10)
            const local = atom(0)
            first.target.set(local, 1)
            second.target.set(local, 2)
            const target = selector(get => get(local) + get(p.state))
            const First = () => <span>{first.read(target)}</span>
            const Second = () => <span>{second.read(target)}</span>
            expect(
                renderToString(
                    <first.Boundary>
                        <First />
                    </first.Boundary>,
                ),
            ).toContain(">11</span>")
            p.server(20)
            expect(
                renderToString(
                    <second.Boundary>
                        <Second />
                    </second.Boundary>,
                ),
            ).toContain(">22</span>")
            expect(p.counts.server).toBe(2)
            expect(p.counts.live).toBe(0)
            expect(p.counts.subscribe).toBe(0)
            first.target.dispose()
            second.target.dispose()
        })
    })
}

test("ordinary useValue rebinds across independent StoreTrees without duplicating existing retention", () => {
    const first = store()
    const second = store()
    const p = probe(3, 0)
    const local = atom(0)
    second.set(local, 100)
    const target = selector(get => get(p.state) + get(local))
    const retainSecond = second.sub(p.state, () => undefined)
    const view = renderHook(
        ({ selected }: { selected: Store }) => useValue(target, selected),
        {
            initialProps: { selected: first },
        },
    )
    expect(view.result.current).toBe(3)
    expect(p.listeners.size).toBe(2)
    expect(p.counts.subscribe).toBe(2)
    view.rerender({ selected: second })
    expect(view.result.current).toBe(103)
    expect(p.listeners.size).toBe(1)
    expect(p.counts.subscribe).toBe(2)
    expect(p.counts.cleanup).toBe(1)
    first.dispose()
    act(() => p.publish(4))
    expect(view.result.current).toBe(104)
    retainSecond()
    expect(p.listeners.size).toBe(1)
    view.unmount()
    expect(p.listeners.size).toBe(0)
    expect(p.counts.cleanup).toBe(2)
    second.dispose()
})

test("actual hydration getter generations cache values/errors and recheck disposal for both bindings", () => {
    const child = Bun.spawnSync({
        cmd: [
            process.execPath,
            `${import.meta.dir}/fixtures/external-hydration-reader.tsx`,
        ],
        cwd: `${import.meta.dir}/..`,
        stdout: "pipe",
        stderr: "pipe",
    })
    expect(child.exitCode, child.stderr.toString()).toBe(0)
    const line = child.stdout
        .toString()
        .split("\n")
        .find(line => line.startsWith("EXTERNAL_HYDRATION_RESULT:"))
    expect(line).toBeDefined()
    expect(
        JSON.parse(line!.slice("EXTERNAL_HYDRATION_RESULT:".length)),
    ).toEqual(
        ["ordinary", "inspect"].map(mode => ({
            mode,
            cachedValue: true,
            stateRebind: true,
            storeRebind: true,
            cachedError: true,
            containedOnce: true,
            disposedWins: true,
        })),
    )
})

test("inspect bindings identify external references without recording snapshot values", () => {
    const b = binding("inspect")
    const p = probe("private-live-snapshot", "private-server-snapshot")
    const View = () => <span>{b.read(p.state)}</span>
    expect(
        renderToString(
            <b.Boundary>
                <View />
            </b.Boundary>,
        ),
    ).toContain("private-server-snapshot")
    const view = render(
        <b.Boundary>
            <View />
        </b.Boundary>,
    )
    expect(view.getByText("private-live-snapshot")).toBeTruthy()
    const recording = b.inspected!.inspect.export()
    expect(recording.complete).toBe(true)
    expect(recording.core.fault).toBeUndefined()
    expect(recording.react.fault).toBeUndefined()
    expect(recording.react.totals.serverSnapshots).toBe(1)
    expect(recording.react.totals.clientSnapshots).toBeGreaterThan(0)
    const snapshots = recording.react.details.filter(
        detail => detail.type === "react-snapshot",
    )
    expect(snapshots.length).toBeGreaterThan(1)
    expect(
        snapshots.every(detail => detail.start.state.kind === "external"),
    ).toBe(true)
    expect(
        snapshots.every(detail => detail.start.state.name === "react-external"),
    ).toBe(true)
    expect(JSON.stringify(recording)).not.toContain("private-live-snapshot")
    expect(JSON.stringify(recording)).not.toContain("private-server-snapshot")
    view.unmount()
    b.target.dispose()
})
