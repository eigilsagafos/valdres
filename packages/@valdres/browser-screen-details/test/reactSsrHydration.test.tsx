import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import {
    requestScreenDetails,
    screenDetailsStatusAtom,
    screenPermissionAtom,
    screensAtom,
} from "../src/index"
import { installScreenDetails, type ScreenHarness } from "./setup/screenFixtures"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let page: ScreenHarness | undefined
afterEach(() => {
    page?.restore()
    page = undefined
})

const Screens = ({ onRender }: { onRender: (value: string) => void }) => {
    const status = useValue(screenDetailsStatusAtom)
    const permission = useValue(screenPermissionAtom)
    const count = useValue(screensAtom).length
    const text = `${status}|${permission}|${count}`
    onRender(text)
    return <span id="screens">{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Screens onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the server seed without requesting, hydrates cleanly, then goes live", async () => {
        page = installScreenDetails()
        // Live: already granted on this page. The server seed is idle.
        const granted = requestScreenDetails()
        page.grant()
        await granted
        const app = store()
        const markup = renderToString(tree(app, () => {}))
        expect(markup).toContain(">idle|prompt|0<")

        const container = document.createElement("div")
        container.innerHTML = markup
        document.body.append(container)
        const rendered: string[] = []
        const recoverable: unknown[] = []
        let root: Root | undefined
        try {
            await act(async () => {
                root = hydrateRoot(container, tree(app, value => rendered.push(value)), {
                    onRecoverableError: error => recoverable.push(error),
                })
            })
            expect(recoverable).toEqual([])
            expect(rendered[0]).toBe("idle|prompt|0")
            expect(rendered.at(-1)).toBe("ready|granted|1")
            expect(page.details.physical()).toBe(3)
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }
        expect(page.details.physical()).toBe(0)
        expect(page.calls).toEqual([])
        app.dispose()
    })
})
