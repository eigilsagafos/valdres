import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { colorSchemeAtom } from "../src/atoms/colorSchemeAtom"
import { COLOR_SCHEME_MEDIA } from "../src/lib/colorSchemeSource"
import { installMediaHarness, type MediaHarness } from "./setup/mediaHarness"

const DARK = COLOR_SCHEME_MEDIA
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let harness: MediaHarness | undefined
afterEach(() => {
    harness?.restore()
    harness = undefined
})

const Scheme = ({ onRender }: { onRender: (value: string) => void }) => {
    const scheme = useValue(colorSchemeAtom)
    onRender(scheme)
    return <span id="scheme">{scheme}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Scheme onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the server value, hydrates cleanly, then switches to the live preference", async () => {
        // The live preference is dark; the deterministic server seed is light.
        harness = installMediaHarness({ [DARK]: true })
        const app = store()
        const rendered: string[] = []

        const markup = renderToString(tree(app, value => rendered.push(value)))
        expect(markup).toContain(">light<")
        // Server rendering samples no live source and attaches nothing.
        expect(harness.listeners(DARK)).toBe(0)

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
                    { onRecoverableError: error => recoverable.push(error) },
                )
            })

            // Hydration matches the server HTML first, then commits the live value.
            expect(recoverable).toEqual([])
            expect(rendered[0]).toBe("light")
            expect(rendered.at(-1)).toBe("dark")
            expect(container.querySelector("#scheme")?.textContent).toBe("dark")
            expect(harness.listeners(DARK)).toBe(1)

            // A later OS change flows through the same subscription.
            harness.set(DARK, false)
            await act(async () => {
                harness!.change(DARK)
            })
            expect(container.querySelector("#scheme")?.textContent).toBe("light")
            expect(harness.listeners(DARK)).toBe(1)
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }

        expect(harness.listeners(DARK)).toBe(0)
        expect(harness.created(DARK)).toBe(1)
        app.dispose()
    })

    test("a second server render of a fresh request store is deterministic", () => {
        harness = installMediaHarness({ [DARK]: true })
        const first = store()
        const second = store()

        expect(renderToString(tree(first, () => {}))).toContain(">light<")
        expect(renderToString(tree(second, () => {}))).toContain(">light<")
        expect(harness.listeners(DARK)).toBe(0)

        first.dispose()
        second.dispose()
    })
})
