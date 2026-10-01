/**
 * Regressions for the #414 implementation review, React side: options are
 * validated on every update, and scope activation is per Store object for
 * Providers that share one scope definition.
 */
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Component, act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { atom, store } from "valdres"
import { Provider } from "valdres-react"
import { hotkeyScope } from "@valdres/hotkeys"
import { useHotkey, useHotkeyScope } from "../src/index"
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
const press = (code: string, key: string) =>
    act(() => {
        kb.down(code, key)
        kb.up(code, key)
    })

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
    state = { error: undefined as unknown }
    static getDerivedStateFromError(error: unknown) {
        return { error }
    }
    render() {
        return this.state.error === undefined ? (
            this.props.children
        ) : (
            <p id="failed">{String(this.state.error)}</p>
        )
    }
}

test("updated options are validated: a NaN priority is rejected, never ranked by registration order", () => {
    const app = store()
    const winner = atom("none")
    const Bind = ({ name, priority }: { name: string; priority: number }) => {
        useHotkey("Escape", tx => tx.set(winner, name), { priority })
        return null
    }
    const tree = (first: number) => (
        <Provider store={app}>
            <Boundary>
                <Bind name="first" priority={first} />
            </Boundary>
            <Bind name="second" priority={1} />
        </Provider>
    )
    render(tree(2)) // "first" registers first
    press("Escape", "Escape")
    expect(app.get(winner)).toBe("first")
    render(tree(0)) // a valid update is adopted in place
    press("Escape", "Escape")
    expect(app.get(winner)).toBe("second")
    const consoleError = console.error
    console.error = () => {}
    render(tree(Number.NaN)) // rejected during render
    console.error = consoleError
    expect(container.querySelector("#failed")?.textContent).toContain(
        "finite number",
    )
    act(() => app.set(winner, "none"))
    press("Escape", "Escape")
    expect(app.get(winner)).toBe("second")
    expect(inspectRegistry(app).bindings).toBe(1)
    expect(kb.reported()).toEqual([])
    app.dispose()
})

test("one scope definition under a root and a child-scope Provider activates per Store", () => {
    const rootStore = store()
    const childStore = rootStore.scope("panel")
    const dialog = hotkeyScope({
        name: "dialog",
        priority: 10,
        exclusive: true,
    })
    const log = atom<string[]>([])
    const Layer = ({ name, active }: { name: string; active: boolean }) => {
        useHotkeyScope(dialog, { active })
        useHotkey(
            "Escape",
            tx => tx.set(log, [...tx.get(log), `${name}:dialog`]),
            { scope: dialog },
        )
        useHotkey("k", tx => tx.set(log, [...tx.get(log), `${name}:k`]))
        return null
    }
    const tree = (rootActive: boolean, childActive: boolean) => (
        <Provider store={rootStore}>
            <Layer name="root" active={rootActive} />
            <Provider store={childStore}>
                <Layer name="child" active={childActive} />
            </Provider>
        </Provider>
    )
    const step = (rootActive: boolean, childActive: boolean) => {
        render(tree(rootActive, childActive))
        act(() => {
            rootStore.set(log, [])
            childStore.set(log, [])
        })
        press("Escape", "Escape")
        press("KeyK", "k")
        return [rootStore.get(log), childStore.get(log)]
    }
    expect(step(true, false)).toEqual([["root:dialog"], ["child:k"]])
    expect(step(true, true)).toEqual([["root:dialog"], ["child:dialog"]])
    expect(step(false, true)).toEqual([["root:k"], ["child:dialog"]])
    expect(step(false, false)).toEqual([["root:k"], ["child:k"]])
    rootStore.dispose()
})
