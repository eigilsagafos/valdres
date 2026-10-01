/**
 * Precedence comes from declared priorities, scopes and eligibility, never
 * from React's commit order; and keys that a component already claimed with
 * `preventDefault` in `onKeyDown` are skipped unless a binding opts in.
 */
import { afterEach, beforeEach, expect, test } from "bun:test"
import { StrictMode, Suspense, act, use, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { atom, store } from "valdres"
import { Provider } from "valdres-react"
import { useHotkey } from "../src/index"
import {
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
const press = (code: string, key: string, target?: EventTarget) =>
    act(() => void kb.down(code, key, { target }))

test("the winner stays the declared one across remounts and Suspense re-shows", async () => {
    const app = store()
    const winner = atom("none")
    const Bind = ({ name, priority }: { name: string; priority: number }) => {
        useHotkey("Escape", tx => tx.set(winner, name), { priority })
        return null
    }
    let pending: Promise<void> | null = null
    let resolve!: () => void
    const Gate = () => (pending ? use(pending) : null, null)
    const tree = (key: string) => (
        <StrictMode>
            <Provider store={app}>
                <Suspense fallback={null}>
                    <Bind key={key} name="outer" priority={1} />
                    <Bind name="inner" priority={0} />
                    <Gate />
                </Suspense>
            </Provider>
        </StrictMode>
    )
    const results: string[] = []
    const check = () => {
        press("Escape", "Escape")
        results.push(app.get(winner))
        act(() => app.set(winner, "none"))
    }
    render(tree("a"))
    check()
    render(tree("b")) // the higher binding remounts: registered last now
    check()
    pending = new Promise<void>(r => (resolve = r))
    render(tree("b")) // hide: both unregister
    press("Escape", "Escape")
    results.push(app.get(winner))
    await act(async () => {
        const p = pending!
        pending = null
        resolve()
        await p
    })
    render(tree("b")) // re-show: both re-register in tree order
    check()
    expect(results).toEqual(["outer", "outer", "none", "outer"])
    app.dispose()
})

test("a key claimed in onKeyDown is skipped, unless the binding opts in", () => {
    const app = store()
    const log = atom<string[]>([])
    const push =
        (entry: string) =>
        (tx: Parameters<Parameters<typeof useHotkey>[1]>[0]) =>
            tx.set(log, [...tx.get(log), entry])
    const Menu = ({ children }: { children?: ReactNode }) => (
        <div
            id="menu"
            tabIndex={0}
            onKeyDown={event =>
                event.key.startsWith("Arrow") && event.preventDefault()
            }
        >
            {children}
        </div>
    )
    const Canvas = () => {
        useHotkey("ArrowDown", push("canvas:down"), { priority: 1 })
        useHotkey("ArrowUp", push("canvas:up"))
        useHotkey("ArrowUp", push("menu-aware:up"), {
            handleDefaultPrevented: true,
            priority: -1,
        })
        return null
    }
    render(
        <Provider store={app}>
            <Menu />
            <Canvas />
        </Provider>,
    )
    const menu = container.querySelector("#menu")!
    press("ArrowDown", "ArrowDown", menu) // claimed by the menu
    press("ArrowUp", "ArrowUp", menu) // claimed: only the opted-in binding is a candidate
    press("ArrowDown", "ArrowDown") // not claimed
    press("ArrowUp", "ArrowUp")
    expect(app.get(log)).toEqual(["menu-aware:up", "canvas:down", "canvas:up"])
    app.dispose()
})
