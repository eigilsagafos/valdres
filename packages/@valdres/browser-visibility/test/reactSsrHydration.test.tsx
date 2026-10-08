import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { isVisibleSelector, visibilityAtom } from "../src/index"
import { installPageHarness, type PageHarness } from "./setup/pageHarness"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let page: PageHarness | undefined
afterEach(() => {
    page?.restore()
    page = undefined
})

const Visibility = ({ onRender }: { onRender: (value: string) => void }) => {
    const state = useValue(visibilityAtom)
    const visible = useValue(isVisibleSelector)
    const text = `${state}|${visible}`
    onRender(text)
    return <span id="visibility">{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Visibility onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the server seed, hydrates cleanly, then switches to the live state", async () => {
        // Live: hidden. The deterministic server seed is visible.
        page = installPageHarness()
        page.setVisibility("hidden")
        const app = store()
        const rendered: string[] = []

        const markup = renderToString(tree(app, value => rendered.push(value)))
        expect(markup).toContain(">visible|true<")
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
            expect(rendered[0]).toBe("visible|true")
            expect(rendered.at(-1)).toBe("hidden|false")
            // Two hooks over one store tree: one physical listener.
            expect(page.listeners("document", "visibilitychange")).toBe(1)

            page.setVisibility("visible")
            await act(async () => page!.fire("document", "visibilitychange"))
            expect(container.querySelector("#visibility")?.textContent).toBe(
                "visible|true",
            )
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }

        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("server renders of fresh request stores are deterministic", () => {
        page = installPageHarness()
        page.setVisibility("hidden")
        const first = store()
        const second = store()
        const a = renderToString(tree(first, () => {}))
        expect(renderToString(tree(second, () => {}))).toBe(a)
        expect(a).toContain(">visible|true<")
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })
})
