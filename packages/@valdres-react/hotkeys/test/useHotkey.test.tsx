import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
    Component,
    Profiler,
    StrictMode,
    Suspense,
    act,
    useState,
    type ReactNode,
} from "react"
import { createRoot, type Root } from "react-dom/client"
import { atom, store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { bindHotkey, hotkeyScope, type HotkeyScope } from "@valdres/hotkeys"
import { useHotkey, useHotkeyScope } from "../src/index"
import { activateKeyboard, lastKeyDownAtom } from "@valdres/browser-keyboard"
import {
    inspectRegistry,
    installKeyboardHarness,
    setPlatform,
    type KeyboardHarness,
} from "./helpers"
;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let kb: KeyboardHarness
let container: HTMLElement
let root: Root
beforeEach(() => {
    setPlatform("Linux x86_64")
    kb = installKeyboardHarness()
    container = document.createElement("div")
    document.body.append(container)
    root = createRoot(container)
})
afterEach(() => {
    act(() => root.unmount())
    container.remove()
    kb.restore()
})

const render = (node: ReactNode) => act(() => root.render(node))
const press = (
    code: string,
    key: string,
    init?: Parameters<KeyboardHarness["down"]>[2],
) => {
    let event!: KeyboardEvent
    act(() => {
        event = kb.down(code, key, init)
    })
    return event
}

describe("store resolution", () => {
    test("nearest Provider, explicit override, and explicit store without any Provider", () => {
        const provided = store()
        const explicit = store()
        const hits = atom(0)
        const Bind = ({ store }: { store?: Store }) => {
            useHotkey("k", tx => tx.set(hits, tx.get(hits) + 1), { store })
            return null
        }
        render(
            <>
                <Provider store={provided}>
                    <Bind />
                    <Bind store={explicit} />
                </Provider>
                <Bind store={explicit} />
            </>,
        )
        expect([
            inspectRegistry(provided).bindings,
            inspectRegistry(explicit).bindings,
        ]).toEqual([1, 2])
        render(null)
        expect([
            inspectRegistry(provided).bindings,
            inspectRegistry(explicit).bindings,
        ]).toEqual([0, 0])
        const Bare = () => (useHotkey("k", () => {}), null)
        const errors: unknown[] = []
        class Boundary extends Component<
            { children: ReactNode },
            { failed: boolean }
        > {
            state = { failed: false }
            static getDerivedStateFromError() {
                return { failed: true }
            }
            componentDidCatch(error: unknown) {
                errors.push(error)
            }
            render() {
                return this.state.failed ? null : this.props.children
            }
        }
        const consoleError = console.error
        console.error = () => {}
        render(
            <Boundary>
                <Bare />
            </Boundary>,
        )
        console.error = consoleError
        expect(String(errors[0])).toContain("no Store")
        provided.dispose()
        explicit.dispose()
    })
})

describe("registration lifetime", () => {
    test("fresh callbacks and options are adopted in place: one registration, stable identity", () => {
        const app = store()
        const log: string[] = []
        const Bind = ({
            label,
            enabled,
        }: {
            label: string
            enabled: boolean
        }) => {
            useHotkey(["x", "y"], () => void log.push(label), { enabled })
            return null
        }
        render(
            <Provider store={app}>
                <Bind label="first" enabled />
            </Provider>,
        )
        const [id] = inspectRegistry(app).ids
        press("KeyX", "x")
        render(
            <Provider store={app}>
                <Bind label="second" enabled />
            </Provider>,
        )
        press("KeyX", "x")
        render(
            <Provider store={app}>
                <Bind label="third" enabled={false} />
            </Provider>,
        )
        press("KeyY", "y")
        render(
            <Provider store={app}>
                <Bind label="fourth" enabled />
            </Provider>,
        )
        press("KeyY", "y")
        expect(log).toEqual(["first", "second", "fourth"])
        expect(inspectRegistry(app).ids).toEqual([id!])
        app.dispose()
    })

    test("a shortcut change is applied in place, keeping identity", () => {
        const app = store()
        const log: string[] = []
        const Bind = ({ keys }: { keys: string }) => {
            useHotkey(keys, (_, hit) => void log.push(hit.shortcut))
            return null
        }
        render(
            <Provider store={app}>
                <Bind keys="a" />
            </Provider>,
        )
        const ids = inspectRegistry(app).ids
        render(
            <Provider store={app}>
                <Bind keys="b" />
            </Provider>,
        )
        press("KeyA", "a")
        press("KeyB", "b")
        expect(log).toEqual(["b"])
        expect(inspectRegistry(app).ids).toEqual(ids)
        app.dispose()
    })

    test("StrictMode: double effects leave one registration, no replay, one run per keydown", () => {
        const app = store()
        const runs = atom(0)
        activateKeyboard()
        kb.down("KeyK", "k") // retained before mount
        const Bind = () => (
            useHotkey("k", tx => tx.set(runs, tx.get(runs) + 1)), null
        )
        render(
            <StrictMode>
                <Provider store={app}>
                    <Bind />
                </Provider>
            </StrictMode>,
        )
        expect(app.get(runs)).toBe(0)
        expect(inspectRegistry(app).bindings).toBe(1)
        kb.up("KeyK", "k")
        press("KeyK", "k")
        expect(app.get(runs)).toBe(1)
        app.dispose()
    })

    test("abandoned renders (suspended, or thrown into a boundary) never register or run", () => {
        const app = store()
        const runs = atom(0)
        const never = new Promise<never>(() => {})
        const Suspends = () => {
            useHotkey("k", tx => tx.set(runs, tx.get(runs) + 1))
            throw never
        }
        class Boundary extends Component<
            { children: ReactNode },
            { failed: boolean }
        > {
            state = { failed: false }
            static getDerivedStateFromError() {
                return { failed: true }
            }
            render() {
                return this.state.failed ? null : this.props.children
            }
        }
        const Throws = () => {
            useHotkey("k", tx => tx.set(runs, tx.get(runs) + 1))
            throw new Error("render failed")
        }
        const consoleError = console.error
        console.error = () => {}
        render(
            <Provider store={app}>
                <Suspense fallback={null}>
                    <Suspends />
                </Suspense>
                <Boundary>
                    <Throws />
                </Boundary>
            </Provider>,
        )
        console.error = consoleError
        expect(inspectRegistry(app).bindings).toBe(0)
        press("KeyK", "k")
        expect(app.get(runs)).toBe(0)
        app.dispose()
    })
})

describe("behaviour through React", () => {
    test("a shared State enabled flag gates React and non-React bindings alike", () => {
        const app = store()
        const canEdit = atom(false)
        const log: string[] = []
        const Bind = () => (
            useHotkey("e", () => void log.push("react"), { enabled: canEdit }),
            null
        )
        render(
            <Provider store={app}>
                <Bind />
            </Provider>,
        )
        bindHotkey(app, "Ctrl+e", () => void log.push("plain"), {
            enabled: canEdit,
        })
        press("KeyE", "e")
        act(() => app.set(canEdit, true))
        expect(log).toEqual([])
        press("KeyE", "e")
        press("ControlLeft", "Control")
        press("KeyE", "e")
        expect(log).toEqual(["react", "plain"])
        app.dispose()
    })

    test("modal scope: Escape closes the modal only; after unmount it reaches the page", () => {
        const app = store()
        const modalOpen = atom(true)
        const pageEscapes = atom(0)
        const modal: HotkeyScope = hotkeyScope({
            name: "modal",
            priority: 10,
            exclusive: true,
        })
        const Modal = () => {
            useHotkeyScope(modal)
            useHotkey("Escape", tx => tx.set(modalOpen, false), {
                scope: modal,
            })
            return <div>modal</div>
        }
        const Page = () => {
            useHotkey("Escape", tx =>
                tx.set(pageEscapes, tx.get(pageEscapes) + 1),
            )
            useHotkey("k", tx => tx.set(pageEscapes, tx.get(pageEscapes) + 100))
            return useValue(modalOpen) ? <Modal /> : null
        }
        render(
            <Provider store={app}>
                <Page />
            </Provider>,
        )
        press("KeyK", "k") // blocked by the exclusive modal
        press("Escape", "Escape")
        expect([
            app.get(modalOpen),
            app.get(pageEscapes),
            container.textContent,
        ]).toEqual([false, 0, ""])
        press("Escape", "Escape")
        expect(app.get(pageEscapes)).toBe(1)
        expect(app.get(modal.active)).toBe(false)
        app.dispose()
    })

    test("one keydown with a command: components read key state and result in one commit (measured)", () => {
        const app = store()
        const saved = atom(0)
        let commits = 0
        const seen: string[] = []
        const View = () => {
            useHotkey("Ctrl+s", tx => tx.set(saved, tx.get(saved) + 1))
            const keyDown = useValue(lastKeyDownAtom)
            const count = useValue(saved)
            seen.push(`${keyDown?.code ?? "-"}:${count}`)
            return null
        }
        render(
            <Provider store={app}>
                <Profiler id="v" onRender={() => void commits++}>
                    <View />
                </Profiler>
            </Provider>,
        )
        press("ControlLeft", "Control")
        const before = commits
        seen.length = 0
        press("KeyS", "s")
        expect(commits - before).toBe(1)
        expect(seen).toEqual(["KeyS:1"])
        app.dispose()
    })

    test("callbacks read the latest committed props", () => {
        const app = store()
        const out = atom("")
        let setLabel!: (label: string) => void
        const Bind = () => {
            const [label, set] = useState("a")
            setLabel = set
            useHotkey("l", tx => tx.set(out, label))
            return null
        }
        render(
            <Provider store={app}>
                <Bind />
            </Provider>,
        )
        act(() => setLabel("b"))
        press("KeyL", "l")
        expect(app.get(out)).toBe("b")
        app.dispose()
    })
})
