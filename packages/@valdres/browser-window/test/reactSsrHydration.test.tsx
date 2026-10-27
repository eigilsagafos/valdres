import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { selector, store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { windowSizeAtom } from "../src/index"
import {
    installGeometryHarness,
    type GeometryHarness,
} from "./setup/geometryHarness"
;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let page: GeometryHarness | undefined
afterEach(() => {
    page?.restore()
    page = undefined
})

const isWide = selector(get => get(windowSizeAtom).innerWidth >= 768)

const Size = ({ onRender }: { onRender: (value: string) => void }) => {
    const { innerWidth, innerHeight } = useValue(windowSizeAtom)
    const wide = useValue(isWide)
    const text = `${innerWidth}x${innerHeight}|${wide}`
    onRender(text)
    return <span id="size">{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Size onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the server seed, hydrates cleanly, then switches to the live size", async () => {
        page = installGeometryHarness()
        page.setWindow({ innerWidth: 1280, innerHeight: 720 })
        const app = store()
        const rendered: string[] = []

        const markup = renderToString(tree(app, value => rendered.push(value)))
        expect(markup).toContain(">0x0|false<")
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
            expect(rendered[0]).toBe("0x0|false")
            expect(rendered.at(-1)).toBe("1280x720|true")
            // Two hooks over one store tree: one physical listener.
            expect(page.attached()).toEqual({ "window:resize": 1 })

            rendered.length = 0
            page.setWindow({ innerWidth: 600, innerHeight: 800 })
            await act(async () => page!.fire("window", "resize"))
            expect(container.querySelector("#size")?.textContent).toBe(
                "600x800|false",
            )
            // Width and height arrive in one publication: no torn render.
            expect(rendered).toEqual(["600x800|false"])

            rendered.length = 0
            await act(async () => page!.fire("window", "resize"))
            expect(rendered).toEqual([])
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }

        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("server renders of fresh request stores are deterministic", () => {
        page = installGeometryHarness()
        page.setWindow({ innerWidth: 1280, innerHeight: 720 })
        const first = store()
        const second = store()
        const a = renderToString(tree(first, () => {}))
        expect(renderToString(tree(second, () => {}))).toBe(a)
        expect(a).toContain(">0x0|false<")
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })
})
