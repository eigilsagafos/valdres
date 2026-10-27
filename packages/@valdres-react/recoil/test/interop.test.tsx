/**
 * Valdres extensions, not Recoil behavior: Recoil hooks reading and writing
 * native Valdres States, and resolving their Store from the nearest
 * valdres-react Provider when no RecoilRoot is above them.
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Component, act, type ReactNode } from "react"
import { cleanup, render } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import {
    atom as valdresAtom,
    externalAtom,
    selector as valdresSelector,
    store as valdresStore,
    type Atom,
    type Selector,
    type Store,
} from "valdres"
import { Provider, useStore, useValue } from "valdres-react"
import {
    DefaultValue,
    RecoilRoot,
    atom,
    selector,
    useRecoilCallback,
    useRecoilState,
    useRecoilValue,
    useResetRecoilState,
    useSetRecoilState,
    toValdresState as toState,
    type SetterOrUpdater,
} from "../src/index"

afterEach(cleanup)

let nextKey = 0
const key = (label: string) => `interop/${label}/${nextKey++}`

/** Captures render errors instead of letting React rethrow them. */
const renderCatching = (element: ReactNode) => {
    const caught: unknown[] = []
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
        override state = { failed: false }
        static getDerivedStateFromError() {
            return { failed: true }
        }
        override componentDidCatch(error: unknown) {
            caught.push(error)
        }
        override render() {
            return this.state.failed ? null : this.props.children
        }
    }
    const quiet = spyOn(console, "error").mockImplementation(() => {})
    try {
        render(<Boundary>{element}</Boundary>)
    } finally {
        quiet.mockRestore()
    }
    return caught
}

/** An external source that counts live subscriptions. */
const countedSource = () => {
    const counts = { live: 0, attached: 0 }
    const state = externalAtom({
        getSnapshot: () => "external",
        subscribe: () => {
            counts.live++
            counts.attached++
            return () => {
                counts.live--
            }
        },
    })
    return { state, counts }
}

describe("native Valdres atoms in Recoil hooks", () => {
    test("read, write, update and reset through the hooks", () => {
        const count = valdresAtom(1)
        let state!: readonly [number, SetterOrUpdater<number>]
        let reset!: () => void
        let set!: SetterOrUpdater<number>
        const Probe = () => {
            state = useRecoilState(count)
            set = useSetRecoilState(count)
            reset = useResetRecoilState(count)
            return (
                <b>
                    {useRecoilValue(count)} {useValue(count)}
                </b>
            )
        }
        const app = valdresStore()
        const { container } = render(
            <Provider store={app}>
                <Probe />
            </Provider>,
        )
        expect(container.textContent).toBe("1 1")
        act(() => state[1](5))
        expect(app.get(count)).toBe(5)
        act(() => set(n => n * 2))
        expect(container.textContent).toBe("10 10")
        act(() => reset())
        expect(app.get(count)).toBe(1)
        act(() => set(7))
        act(() => (set as (value: unknown) => void)(new DefaultValue()))
        expect(app.get(count)).toBe(1)
    })

    test("keeps Valdres semantics: its own equal and its initial value", () => {
        const doc = valdresAtom({ v: 1 }, { equal: (a, b) => a.v === b.v })
        const app = valdresStore()
        const initial = app.get(doc)
        let set!: SetterOrUpdater<{ v: number }>
        let renders = 0
        const Probe = () => {
            renders++
            set = useSetRecoilState(doc)
            useRecoilValue(doc)
            return null
        }
        render(
            <Provider store={app}>
                <Probe />
            </Provider>,
        )
        const before = renders
        act(() => set({ v: 1 }))
        expect(renders).toBe(before)
        expect(app.get(doc)).toBe(initial)
    })

    test("work in selectors, callbacks, snapshots and transact_UNSTABLE", () => {
        const native = valdresAtom(2)
        const doubled = selector({
            key: key("doubled"),
            get: ({ get }) => get(native) * 2,
            set: ({ set }, value) =>
                set(native, value instanceof DefaultValue ? value : value / 2),
        })
        const fromNative = atom({ key: key("from-native"), default: native })
        let run!: () => unknown
        let setDoubled!: SetterOrUpdater<number>
        const Probe = () => {
            setDoubled = useSetRecoilState(doubled)
            run = useRecoilCallback(({ snapshot, set, reset, transact_UNSTABLE }) => () => {
                const seen = snapshot.getLoadable(native).contents
                set(native, n => n + 1)
                transact_UNSTABLE(({ get, set }) => set(native, get(native) * 100))
                reset(fromNative)
                return seen
            })
            return (
                <b>
                    {useRecoilValue(doubled)} {useRecoilValue(fromNative)}
                </b>
            )
        }
        const { container } = render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(container.textContent).toBe("4 2")
        act(() => setDoubled(10))
        expect(container.textContent).toBe("10 5")
        let seen: unknown
        act(() => (seen = run()))
        expect(seen).toBe(5)
        // transact applies immediately (500), then the queued updater (501).
        expect(container.textContent).toBe("1002 501")
    })
})

describe("native Valdres selectors and other States", () => {
    test("are readable, and writes to them are rejected", () => {
        const count = valdresAtom(3)
        const tripled: Selector<number> = valdresSelector(get => get(count) * 3)
        let set!: (value: number) => void
        let run!: () => void
        const Probe = () => {
            set = useSetRecoilState(tripled as never)
            run = useRecoilCallback(({ set }) => () => set(tripled as never, 1))
            return <b>{useRecoilValue(tripled)}</b>
        }
        const { container } = render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(container.textContent).toBe("9")
        expect(() => set(1)).toThrow("Attempt to set read-only RecoilValue")
        expect(() => act(() => run())).toThrow("Attempt to set read-only RecoilValue")
        expect(container.textContent).toBe("9")
    })

    test("read-only States are rejected by the types", () => {
        const tripled: Selector<number> = valdresSelector(() => 3)
        const writable: Atom<number> = valdresAtom(0)
        const typesOnly = () => {
            // @ts-expect-error a Valdres Selector is read-only
            useSetRecoilState(tripled)
            // @ts-expect-error a Valdres Selector is read-only
            useRecoilState(tripled)
            // @ts-expect-error a Valdres Selector is read-only
            useResetRecoilState(tripled)
            useRecoilCallback(({ set }) => () => {
                // @ts-expect-error a Valdres Selector is read-only
                set(tripled, 1)
                set(writable, 1)
            })
            const value: number = useRecoilValue(tripled)
            return value
        }
        void typesOnly
    })

    test("an ExternalAtom subscribes while read and releases on unmount", () => {
        const { state, counts } = countedSource()
        const Probe = () => <b>{useRecoilValue(state)}</b>
        const view = render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(view.container.textContent).toBe("external")
        expect(counts.live).toBe(1)
        view.unmount()
        expect(counts.live).toBe(0)
    })
})

describe("Store resolution", () => {
    test("without a RecoilRoot the hooks use the nearest Provider's Store", () => {
        const name = atom({ key: key("provider"), default: "default" })
        const first = valdresStore()
        const second = valdresStore()
        const setters: SetterOrUpdater<string>[] = []
        const Probe = ({ id }: { id: string }) => {
            const [value, set] = useRecoilState(name)
            setters.push(set)
            return (
                <i>
                    {id}:{value};
                </i>
            )
        }
        const { container } = render(
            <>
                <Provider store={first}>
                    <Probe id="a" />
                </Provider>
                <Provider store={second}>
                    <Probe id="b" />
                    <Provider store={first}>
                        <Probe id="c" />
                    </Provider>
                </Provider>
            </>,
        )
        act(() => setters[0]!("first"))
        expect(container.textContent).toBe("a:first;b:default;c:first;")
    })

    test("a RecoilRoot takes precedence over any Provider", () => {
        const name = atom({ key: key("precedence"), default: "default" })
        const outer = valdresStore()
        const inner = valdresStore()
        const stores: Record<string, Store> = {}
        let setInRoot!: SetterOrUpdater<string>
        const Root = () => {
            setInRoot = useSetRecoilState(name)
            return null
        }
        const Probe = ({ id }: { id: string }) => {
            stores[id] = useStore()
            return (
                <i>
                    {id}:{useRecoilValue(name)};
                </i>
            )
        }
        const { container } = render(
            <Provider store={outer}>
                <Probe id="provider" />
                <RecoilRoot>
                    <Root />
                    <Probe id="root" />
                    <Provider store={inner}>
                        <Probe id="innerProvider" />
                    </Provider>
                </RecoilRoot>
            </Provider>,
        )
        act(() => setInRoot("root"))
        expect(container.textContent).toBe("provider:default;root:root;innerProvider:root;")
        // valdres-react hooks still see the nearest Provider.
        expect(stores.provider).toBe(outer)
        expect(stores.innerProvider).toBe(inner)
        expect(stores.root).not.toBe(outer)
        expect(outer.get(toState(name))).toBe("default")
    })

    test("override={false} under a Provider alone still creates its own root", () => {
        const name = atom({ key: key("override"), default: "default" })
        const app = valdresStore()
        let set!: SetterOrUpdater<string>
        const Probe = () => {
            set = useSetRecoilState(name)
            return <b>{useRecoilValue(name)}</b>
        }
        render(
            <Provider store={app}>
                <RecoilRoot override={false}>
                    <Probe />
                </RecoilRoot>
            </Provider>,
        )
        act(() => set("root"))
        expect(app.get(toState(name))).toBe("default")
    })

    test("with neither, the hooks throw", () => {
        const name = atom({ key: key("missing"), default: 0 })
        const Probe = () => (useRecoilValue(name), null)
        const caught = renderCatching(<Probe />)
        expect(String((caught[0] as Error).message)).toBe(
            "This component must be used inside a <RecoilRoot> component or a valdres-react <Provider>.",
        )
        expect(() => renderToString(<Probe />)).toThrow("<RecoilRoot>")
    })

    test("a Provider's Store is never disposed; subscriptions are released", () => {
        const { state, counts } = countedSource()
        const name = atom({ key: key("owned"), default: "default" })
        const app = valdresStore()
        let set!: SetterOrUpdater<string>
        const Probe = () => {
            set = useSetRecoilState(name)
            return (
                <b>
                    {useRecoilValue(state)} {useRecoilValue(name)}
                </b>
            )
        }
        const view = render(
            <Provider store={app}>
                <Probe />
            </Provider>,
        )
        act(() => set("written"))
        expect(counts.live).toBe(1)
        view.unmount()
        expect(counts.live).toBe(0)
        expect(app.get(toState(name))).toBe("written")
        app.set(valdresAtom(0), 1)
        app.dispose()
    })

    test("a scoped Provider keeps Valdres scope semantics", () => {
        // Recoil has no scopes. Under a Provider whose Store is a scope, Recoil
        // atoms read their parent's values until written, and a reset in the
        // scope reveals the parent's value rather than the atom's default.
        const name = atom({ key: key("scope"), default: "default" })
        const app = valdresStore()
        const draft = app.scope("draft")
        let set!: SetterOrUpdater<string>
        let reset!: () => void
        const Probe = () => {
            set = useSetRecoilState(name)
            reset = useResetRecoilState(name)
            return <b>{useRecoilValue(name)}</b>
        }
        let setRoot!: SetterOrUpdater<string>
        const RootWriter = () => ((setRoot = useSetRecoilState(name)), null)
        const { container } = render(
            <Provider store={app}>
                <RootWriter />
                <Provider store={draft}>
                    <Probe />
                </Provider>
            </Provider>,
        )
        act(() => setRoot("parent"))
        expect(container.textContent).toBe("parent")
        act(() => set("draft"))
        expect(container.textContent).toBe("draft")
        act(() => reset())
        expect(container.textContent).toBe("parent")
    })

    test("callbacks under a Provider batch against its Store", () => {
        const name = atom({ key: key("provider-callback"), default: 0 })
        const app = valdresStore()
        let run!: () => unknown
        const Probe = () => {
            run = useRecoilCallback(({ snapshot, set }) => () => {
                set(name, n => n + 1)
                set(name, n => n + 1)
                return snapshot.getLoadable(name).contents
            })
            return <b>{useRecoilValue(name)}</b>
        }
        const { container } = render(
            <Provider store={app}>
                <Probe />
            </Provider>,
        )
        let seen: unknown
        act(() => (seen = run()))
        expect(seen).toBe(0)
        expect(container.textContent).toBe("2")
    })
})

describe("mixed migration (the documented example)", () => {
    test("Recoil and native state side by side under one Provider", () => {
        // Native state is introduced first; legacy components keep Recoil hooks.
        const filter = valdresAtom("all")
        const todos = atom({ key: key("todos"), default: ["a", "b"] })
        const visible = selector({
            key: key("visible"),
            get: ({ get }) => (get(filter) === "all" ? get(todos) : []),
        })
        const app = valdresStore()
        let setFilter!: SetterOrUpdater<string>
        const Legacy = () => {
            setFilter = useSetRecoilState(filter)
            return <i>{useRecoilValue(visible).join(",")}</i>
        }
        const Native = () => <b>{useValue(filter)}</b>
        const { container } = render(
            <Provider store={app}>
                <Legacy />
                <Native />
            </Provider>,
        )
        expect(container.textContent).toBe("a,ball")
        act(() => setFilter("none"))
        expect(container.textContent).toBe("none")
        expect(app.get(filter)).toBe("none")
    })
})

