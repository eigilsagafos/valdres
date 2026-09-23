import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { act, StrictMode, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { pressedCodesSelector, toggleKeySelector } from "../src/index"
import { activateKeyboardHub, peekKeyboardHub } from "../src/lib/keyboardHubs"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "./setup/keyboardHarness"
;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let kb: KeyboardHarness
beforeEach(() => {
    kb = installKeyboardHarness()
})
afterEach(() => {
    kb.restore()
})

const Keys = ({ onRender }: { onRender: (value: string) => void }) => {
    const codes = useValue(pressedCodesSelector)
    const caps = useValue(toggleKeySelector("CapsLock"))
    const text = `${codes.join("+") || "none"}|caps:${caps}`
    onRender(text)
    return <span id="keys">{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <StrictMode>
        <Provider store={app}>
            <Keys onRender={onRender} />
        </Provider>
    </StrictMode>
)

describe("React server render and hydration", () => {
    test("server render neither activates the hub nor attaches listeners", () => {
        const app = store()
        const markup = renderToString(tree(app, () => {}))
        expect(markup).toContain(">none|caps:null<")
        expect(peekKeyboardHub()).toBeUndefined()
        expect(kb.physical()).toBe(0)

        // Deterministic across request stores.
        const second = store()
        expect(renderToString(tree(second, () => {}))).toBe(markup)
        second.dispose()
        app.dispose()
    })

    test("hydrates the empty server value, then catches up to keys observed earlier", async () => {
        // The client hub is already tracking a held key when hydration starts.
        activateKeyboardHub()
        kb.setLock("CapsLock", true)
        kb.down("ShiftLeft", "Shift")

        const app = store()
        const rendered: string[] = []
        const markup = renderToString(tree(app, value => rendered.push(value)))
        expect(markup).toContain(">none|caps:null<")

        const container = document.createElement("div")
        container.innerHTML = markup
        document.body.append(container)
        rendered.length = 0

        const recoverable: unknown[] = []
        let root: Root | undefined
        try {
            await act(async () => {
                root = hydrateRoot(
                    container,
                    tree(app, value => rendered.push(value)),
                    {
                        onRecoverableError: error => recoverable.push(error),
                    },
                )
            })

            expect(recoverable).toEqual([])
            expect(rendered[0]).toBe("none|caps:null")
            expect(rendered.at(-1)).toBe("ShiftLeft|caps:true")
            expect(container.querySelector("#keys")?.textContent).toBe(
                "ShiftLeft|caps:true",
            )
            // StrictMode's extra effect cycle leaves one registration.
            expect(kb.invalidators()).toBe(1)
            expect(kb.physical()).toBe(4)
            expect(kb.attached()).toMatchObject({
                "document:keydown": 1,
                "document:keyup": 1,
                "document:visibilitychange": 1,
                "window:blur": 1,
            })

            await act(async () => {
                kb.down("KeyK", "k")
            })
            expect(container.querySelector("#keys")?.textContent).toBe(
                "ShiftLeft+KeyK|caps:true",
            )

            await act(async () => {
                kb.blur()
            })
            expect(container.querySelector("#keys")?.textContent).toBe(
                "none|caps:null",
            )
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }

        // Unmounting releases the store's invalidator, never the hub.
        expect(kb.invalidators()).toBe(0)
        expect(kb.physical()).toBe(4)
        app.dispose()
    })

    test("hydration with an unactivated hub activates it through the subscription", async () => {
        const app = store()
        const markup = renderToString(tree(app, () => {}))
        const container = document.createElement("div")
        container.innerHTML = markup
        document.body.append(container)

        const recoverable: unknown[] = []
        let root: Root | undefined
        try {
            await act(async () => {
                root = hydrateRoot(
                    container,
                    tree(app, () => {}),
                    {
                        onRecoverableError: error => recoverable.push(error),
                    },
                )
            })
            expect(recoverable).toEqual([])
            expect(kb.physical()).toBe(4)

            await act(async () => {
                kb.down("KeyA", "a")
            })
            expect(container.querySelector("#keys")?.textContent).toBe(
                "KeyA|caps:false",
            )
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }
        app.dispose()
    })
})
