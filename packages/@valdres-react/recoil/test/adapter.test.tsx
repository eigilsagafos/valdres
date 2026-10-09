/**
 * Adapter behavior the Recoil differential cannot observe: interop with
 * Valdres, explicit refusals, cross-root batches, hydration and StrictMode.
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { StrictMode, act, useState } from "react"
import { cleanup, render } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { atom as valdresAtom, store as valdresStore } from "valdres"
import { useSetAtom, useStore, useValue } from "valdres-react"
import {
    DefaultValue,
    RecoilRoot,
    UnsupportedRecoilFeatureError,
    atom,
    atomFamily,
    isRecoilValue,
    selector,
    toValdresState,
    useRecoilCallback,
    useRecoilState,
    useRecoilValue,
    useSetRecoilState,
    type CallbackInterface,
    type MutableSnapshot,
    type RecoilState,
    type Snapshot,
} from "../src/index"

afterEach(cleanup)

let nextKey = 0
const key = (label: string) => `adapter/${label}/${nextKey++}`

const refusal = (callback: () => unknown): string | undefined => {
    try {
        callback()
    } catch (error) {
        if (error instanceof UnsupportedRecoilFeatureError) return error.feature
        throw error
    }
    return undefined
}

describe("Valdres interop", () => {
    test("RecoilRoot provides its Store to valdres-react hooks", () => {
        const count = atom({ key: key("count"), default: 1 })
        const doubled = selector({ key: key("doubled"), get: ({ get }) => get(count) * 2 })
        const native = valdresAtom("native")
        let setCount!: (value: number) => void
        let setNative!: (value: string) => void
        const Probe = () => {
            setCount = useSetRecoilState(count)
            setNative = useSetAtom(native)
            return (
                <b>
                    {useValue(toValdresState(doubled))} {useValue(native)} {useRecoilValue(count)}
                </b>
            )
        }
        const { container } = render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(container.textContent).toBe("2 native 1")
        act(() => setCount(5))
        act(() => setNative("changed"))
        expect(container.textContent).toBe("10 changed 5")
    })

    test("toValdresState is read-only", () => {
        const count = atom({ key: key("read-only"), default: 1 })
        const app = valdresStore()
        expect(app.get(toValdresState(count))).toBe(1)
        expect(() => app.set(toValdresState(count) as never, 2)).toThrow(TypeError)
    })

    test("each RecoilRoot owns a distinct Store", () => {
        const stores: unknown[] = []
        const Probe = () => (stores.push(useStore()), null)
        render(
            <>
                <RecoilRoot>
                    <Probe />
                </RecoilRoot>
                <RecoilRoot>
                    <Probe />
                    <RecoilRoot override={false}>
                        <Probe />
                    </RecoilRoot>
                </RecoilRoot>
            </>,
        )
        expect(stores[0]).not.toBe(stores[1])
        expect(stores[1]).toBe(stores[2])
    })

    test("only adapter atoms and selectors are Recoil values", () => {
        const native = valdresAtom(0)
        expect(isRecoilValue(native)).toBe(false)
        const Probe = () => (useRecoilValue(native as never), null)
        const errors: unknown[] = []
        class Boundary extends (require("react") as typeof import("react")).Component<
            { children: React.ReactNode },
            { failed: boolean }
        > {
            override state = { failed: false }
            static getDerivedStateFromError() {
                return { failed: true }
            }
            override componentDidCatch(error: unknown) {
                errors.push(error)
            }
            override render() {
                return this.state.failed ? null : this.props.children
            }
        }
        const restore = spyOn(console, "error").mockImplementation(() => {})
        render(
            <RecoilRoot>
                <Boundary>
                    <Probe />
                </Boundary>
            </RecoilRoot>,
        )
        restore.mockRestore()
        expect(String((errors[0] as Error).message)).toContain(
            "Invalid argument to useRecoilValue",
        )
    })
})

describe("keys", () => {
    test("a reused key warns once per key and keeps separate state", () => {
        const warn = spyOn(console, "warn").mockImplementation(() => {})
        const label = key("dup")
        atom({ key: label, default: 1 })
        atom({ key: label, default: 2 })
        atom({ key: label, default: 3 })
        const family = atomFamily({ key: key("family"), default: 0 })
        family(1)
        family(1)
        const calls = warn.mock.calls.map(call => String(call[0]))
        warn.mockRestore()
        expect(calls.length).toBe(2)
        expect(calls[0]).toContain(`Duplicate atom key "${label}"`)
    })
})

describe("refusals", () => {
    test("UnsupportedRecoilFeatureError names the feature", () => {
        const error = new UnsupportedRecoilFeatureError("x", "Do y.")
        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe("UnsupportedRecoilFeatureError")
        expect(error.code).toBe("VALDRES_RECOIL_UNSUPPORTED")
        expect(error.message).toBe("@valdres-react/recoil does not support x. Do y.")
    })

    test("effects are refused at definition; empty lists are accepted", () => {
        expect(
            refusal(() => atom({ key: key("fx"), default: 0, effects: [() => {}] as never })),
        ).toBe("atom effects")
        expect(
            refusal(() => atom({ key: key("fx-empty"), default: 0, effects: [] })),
        ).toBeUndefined()
    })

    test("a Promise written to an atom is refused and nothing commits", () => {
        const a = atom<unknown>({ key: key("async-write"), default: 0 })
        let set!: (value: unknown) => void
        const Probe = () => {
            const [value, setValue] = useRecoilState(a)
            set = setValue
            return <b>{String(value)}</b>
        }
        const { container } = render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(refusal(() => set(() => Promise.resolve(1)))).toBe("async atom values")
        expect(container.textContent).toBe("0")
    })

    test("the MutableSnapshot is closed once initializeState returns", () => {
        const a = atom({ key: key("init-closed"), default: 0 })
        let kept!: MutableSnapshot
        render(<RecoilRoot initializeState={snapshot => void (kept = snapshot)}>{null}</RecoilRoot>)
        expect(refusal(() => kept.set(a, 1))).toBe("MutableSnapshot after initializeState")
        expect(refusal(() => kept.getLoadable(a))).toBe("MutableSnapshot after initializeState")
    })

    test("refused reads throw from snapshots instead of becoming error loadables", () => {
        const pending = atom<number>({ key: key("snapshot-pending") })
        let run!: () => unknown
        const Probe = () => {
            run = useRecoilCallback(({ snapshot }) => () => snapshot.getLoadable(pending))
            return null
        }
        render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(refusal(() => run())).toBe("atoms without a default")
    })

    test("snapshot introspection, retention and async mapping are refused", () => {
        const a = atom({ key: key("snapshot-members"), default: 0 })
        let snapshot!: Snapshot & Record<string, () => unknown>
        let run!: () => unknown
        const Probe = () => {
            run = useRecoilCallback(({ snapshot: current }) => () => {
                snapshot = current as never
                expect(current.getID()).toBe(current.getID())
                return current.getLoadable(a).map(value => Promise.resolve(value))
            })
            return null
        }
        render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(refusal(() => run())).toBe("Loadable.map to a Promise")
        for (const member of [
            "getNodes_UNSTABLE",
            "getInfo_UNSTABLE",
            "map",
            "asyncMap",
            "retain",
            "isRetained",
        ])
            expect(refusal(() => snapshot[member]!())).toBeString()
    })

    test("a selector set handler cannot write after it returns", () => {
        const a = atom({ key: key("late-set-a"), default: 0 })
        let late!: () => void
        const s = selector({
            key: key("late-set"),
            get: ({ get }) => get(a),
            set: ({ set }, value) => {
                late = () => set(a, value as number)
            },
        })
        let setS!: (value: number) => void
        const Probe = () => ((setS = useSetRecoilState(s)), null)
        render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        act(() => setS(1))
        expect(late).toThrow("Recoil: Async selector sets are not currently supported.")
    })

    test("transact_UNSTABLE refuses selectors like Recoil", () => {
        const a = atom({ key: key("transact-a"), default: 0 })
        const s = selector({ key: key("transact-s"), get: ({ get }) => get(a) })
        let run!: () => void
        const Probe = () => {
            run = useRecoilCallback(({ transact_UNSTABLE }) => () =>
                transact_UNSTABLE(({ get }) => get(s)),
            )
            return null
        }
        render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(() => act(() => run())).toThrow(
            "Reading selectors within atomicUpdate is not supported",
        )
    })

    test("a factory that does not return a function throws Recoil's error", () => {
        let run!: () => void
        const Probe = () => {
            run = useRecoilCallback((() => "nope") as never)
            return null
        }
        render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(() => run()).toThrow("useRecoilCallback() expects a function")
    })
})

describe("batches", () => {
    test("writes to another root inside a callback apply after its commit", () => {
        const a = atom({ key: key("cross-a"), default: 0 })
        const b = atom({ key: key("cross-b"), default: 0 })
        let setB!: (value: number) => void
        let run!: () => void
        const Other = () => {
            const [value, set] = useRecoilState(b)
            setB = set
            return <i>{value}</i>
        }
        const Main = () => {
            const value = useRecoilValue(a)
            run = useRecoilCallback(({ set }) => () => {
                set(a, 1)
                setB(2)
            })
            return <b>{value}</b>
        }
        const { container } = render(
            <>
                <RecoilRoot>
                    <Main />
                </RecoilRoot>
                <RecoilRoot>
                    <Other />
                </RecoilRoot>
            </>,
        )
        act(() => run())
        expect(container.textContent).toBe("12")
    })

    test("direct Store operations inside a callback's synchronous part throw", () => {
        const a = atom({ key: key("direct"), default: 0 })
        let run!: () => unknown
        const Probe = () => {
            const store = useStore()
            run = useRecoilCallback(() => () => store.get(toValdresState(a)))
            return null
        }
        render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(() => run()).toThrow(expect.objectContaining({ name: "TransactionPhaseError" }))
    })

    test("a nested batch that fails after staging aborts the outer callback", () => {
        const a = atom({ key: key("poison-a"), default: 0 })
        const readonly = selector({ key: key("poison-ro"), get: () => 0 })
        let run!: () => unknown
        const Probe = () => {
            const value = useRecoilValue(a)
            const inner = useRecoilCallback(({ set }: CallbackInterface) => () => {
                set(a, 1)
                set(readonly as unknown as RecoilState<number>, 1)
            })
            run = useRecoilCallback(({ set }) => () => {
                set(a, 5)
                try {
                    inner()
                } catch {
                    return "swallowed"
                }
            })
            return <b>{value}</b>
        }
        const { container } = render(
            <RecoilRoot>
                <Probe />
            </RecoilRoot>,
        )
        expect(refusal(() => act(() => run()))).toBe(
            "partially failed nested callback batches",
        )
        expect(container.textContent).toBe("0")
    })

    test("a reset through DefaultValue inside initializeState", () => {
        const a = atom({ key: key("init-default"), default: "default" })
        const Probe = () => <b>{useRecoilValue(a)}</b>
        const { container } = render(
            <RecoilRoot
                initializeState={({ set }) => {
                    set(a, "set")
                    set(a, new DefaultValue())
                }}
            >
                <Probe />
            </RecoilRoot>,
        )
        expect(container.textContent).toBe("default")
    })
})

describe("rendering", () => {
    test("server markup from initializeState hydrates without mismatch", async () => {
        const a = atom({ key: key("hydrate"), default: "default" })
        const upper = selector({ key: key("hydrate-upper"), get: ({ get }) => get(a).toUpperCase() })
        const App = () => (
            <RecoilRoot initializeState={({ set }) => set(a, "server")}>
                <Read />
            </RecoilRoot>
        )
        const Read = () => (
            <b>
                {useRecoilValue(a)} {useRecoilValue(upper)}
            </b>
        )
        const html = renderToString(<App />)
        expect(html).toBe("<b>server<!-- --> <!-- -->SERVER</b>")
        const container = document.createElement("div")
        container.innerHTML = html
        document.body.append(container)
        const errors: unknown[] = []
        const restore = spyOn(console, "error").mockImplementation(error => errors.push(error))
        const root = await act(async () =>
            hydrateRoot(container, <App />, { onRecoverableError: error => errors.push(error) }),
        )
        restore.mockRestore()
        expect(errors).toEqual([])
        expect(container.textContent).toBe("server SERVER")
        act(() => root.unmount())
        container.remove()
    })

    test("server rendering surfaces the getter's own error", () => {
        const thrown = new Error("server failure")
        const failing = selector({ key: key("ssr-fail"), get: () => { throw thrown } })
        const Read = () => <b>{useRecoilValue(failing)}</b>
        let caught: unknown
        try {
            renderToString(
                <RecoilRoot>
                    <Read />
                </RecoilRoot>,
            )
        } catch (error) {
            caught = error
        }
        expect(caught).toBe(thrown)
    })

    test("StrictMode keeps one Store per root across its remount", () => {
        const a = atom({ key: key("strict"), default: 0 })
        let set!: (value: number) => void
        let toggle!: () => void
        const Probe = () => {
            const [value, setValue] = useRecoilState(a)
            set = setValue
            return <b>{value}</b>
        }
        const App = () => {
            const [shown, setShown] = useState(true)
            toggle = () => setShown(current => !current)
            return <RecoilRoot>{shown ? <Probe /> : null}</RecoilRoot>
        }
        const { container } = render(
            <StrictMode>
                <App />
            </StrictMode>,
        )
        act(() => set(1))
        act(() => toggle())
        act(() => toggle())
        expect(container.textContent).toBe("1")
    })
})
