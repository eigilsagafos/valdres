import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { selector, store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { screenAtom } from "../src/index"
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

const isRetina = selector(get => get(screenAtom).devicePixelRatio >= 2)

const Screen = ({ onRender }: { onRender: (value: string) => void }) => {
    const { width, height, orientationType } = useValue(screenAtom)
    const retina = useValue(isRetina)
    const text = `${width}x${height} ${orientationType}|${retina}`
    onRender(text)
    return <span id="screen">{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Screen onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the server seed, hydrates cleanly, then switches to the live screen", async () => {
        page = installGeometryHarness()
        page.setScreen({ width: 2560, height: 1440 })
        page.setDevicePixelRatio(2)
        const app = store()
        const rendered: string[] = []

        const markup = renderToString(tree(app, value => rendered.push(value)))
        expect(markup).toContain(">0x0 landscape-primary|false<")
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
            expect(rendered[0]).toBe("0x0 landscape-primary|false")
            expect(rendered.at(-1)).toBe("2560x1440 landscape-primary|true")
            // Two hooks over one store tree: one set of listeners.
            expect(page.attached()).toEqual({
                "window:resize": 1,
                "screen:change": 1,
                "orientation:change": 1,
                "resolution:change": 1,
            })

            // A rotation: every field moves, then both events fire. One render.
            rendered.length = 0
            page.setScreen({ width: 1440, height: 2560 })
            page.setOrientation("portrait-primary", 90)
            await act(async () => {
                page!.fire("orientation", "change")
                page!.fire("window", "resize")
            })
            expect(rendered).toEqual(["1440x2560 portrait-primary|true"])

            rendered.length = 0
            await act(async () => {
                page!.changeResolution(1)
            })
            expect(container.querySelector("#screen")?.textContent).toBe(
                "1440x2560 portrait-primary|false",
            )
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }

        expect(page.physical()).toBe(0)
        app.dispose()
    })

    test("server renders of fresh request stores are deterministic", () => {
        page = installGeometryHarness()
        page.setScreen({ width: 2560, height: 1440 })
        const first = store()
        const second = store()
        const a = renderToString(tree(first, () => {}))
        expect(renderToString(tree(second, () => {}))).toBe(a)
        expect(a).toContain(">0x0 landscape-primary|false<")
        expect(page.physical()).toBe(0)
        first.dispose()
        second.dispose()
    })
})
