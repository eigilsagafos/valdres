import { afterEach, describe, expect, test } from "bun:test"
import { act, StrictMode, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { focusAtom } from "../src/index"
import { peekFocusHub, resolveFocusHost } from "../src/lib/focusHubs"
import { installPageHarness, type PageHarness } from "./setup/pageHarness"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let page: PageHarness | undefined
afterEach(() => {
    page?.restore()
    page = undefined
})

const Focus = ({ onRender }: { onRender: (value: string) => void }) => {
    const focused = useValue(focusAtom)
    const text = focused ? "focused" : "blurred"
    onRender(text)
    return <span id="focus">{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <StrictMode>
        <Provider store={app}>
            <Focus onRender={onRender} />
        </Provider>
    </StrictMode>
)

describe("React server render and hydration", () => {
    test("renders the server seed, hydrates cleanly, then switches to the live state", async () => {
        // Live: blurred. The deterministic server seed is focused.
        page = installPageHarness()
        page.setHasFocus(false)
        const app = store()
        const rendered: string[] = []

        const markup = renderToString(tree(app, value => rendered.push(value)))
        expect(markup).toContain(">focused<")
        expect(page.physical()).toBe(0)

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
            expect(recoverable).toEqual([])
            expect(rendered[0]).toBe("focused")
            expect(rendered.at(-1)).toBe("blurred")
            // StrictMode's extra effect cycle leaves one registration.
            expect(peekFocusHub(resolveFocusHost()!)?.registrations()).toBe(1)
            expect(page.physical()).toBe(2)

            await act(async () => page!.fire("window", "focus"))
            expect(container.querySelector("#focus")?.textContent).toBe("focused")
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }

        expect(page.physical()).toBe(0)
        expect(peekFocusHub(resolveFocusHost()!)).toBeUndefined()
        app.dispose()
    })

    test("server renders of fresh request stores are deterministic", () => {
        page = installPageHarness()
        page.setHasFocus(false)
        const first = store()
        const second = store()
        const a = renderToString(tree(first, () => {}))
        expect(renderToString(tree(second, () => {}))).toBe(a)
        expect(a).toContain(">focused<")
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })
})
