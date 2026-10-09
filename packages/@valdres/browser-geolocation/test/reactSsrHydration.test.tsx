import { afterEach, describe, expect, test } from "bun:test"
import { act, useEffect, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import {
    geolocationStatusAtom,
    permissionAtom,
    positionAtom,
    watchGeolocation,
} from "../src/index"
import { flush } from "./setup/deviceHarness"
import { installGeolocation, position } from "./setup/geolocationFixtures"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let page: ReturnType<typeof installGeolocation> | undefined
afterEach(() => {
    page?.restore()
    page = undefined
})

const Location = ({
    app,
    watch,
    onRender,
}: {
    app: Store
    watch: boolean
    onRender: (value: string) => void
}) => {
    const status = useValue(geolocationStatusAtom)
    const permission = useValue(permissionAtom)
    const latitude = useValue(positionAtom)?.latitude ?? "none"
    // The explicit trigger: an effect never runs during a server render.
    useEffect(() => (watch ? watchGeolocation(app) : undefined), [app, watch])
    const text = `${status}|${permission}|${latitude}`
    onRender(text)
    return <span id="location">{text}</span>
}

const tree = (app: Store, watch: boolean, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Location app={app} watch={watch} onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the server seed without watching, hydrates cleanly, then watches", async () => {
        page = installGeolocation()
        const permissions = page.installPermissions()
        permissions.set("geolocation", "granted")
        const app = store()
        const markup = renderToString(tree(app, true, () => {}))
        expect(markup).toContain(">idle|prompt|none<")
        expect(page.geolocation.watches).toEqual([])
        expect(permissions.queries).toEqual([])

        const container = document.createElement("div")
        container.innerHTML = markup
        document.body.append(container)
        const rendered: string[] = []
        const recoverable: unknown[] = []
        let root: Root | undefined
        try {
            await act(async () => {
                root = hydrateRoot(container, tree(app, true, value => rendered.push(value)), {
                    onRecoverableError: error => recoverable.push(error),
                })
            })
            await act(flush)
            expect(recoverable).toEqual([])
            expect(rendered[0]).toBe("idle|prompt|none")
            expect(page.geolocation.live()).toHaveLength(1)
            await act(async () => page!.geolocation.watches[0]!.success(position(42)))
            expect(container.querySelector("#location")?.textContent).toBe(
                "active|granted|42",
            )
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }
        expect(page.geolocation.live()).toHaveLength(0)
        expect(permissions.changeListeners()).toBe(0)
        app.dispose()
    })

    test("hydrating a store whose watch already started still matches the server seed", async () => {
        page = installGeolocation()
        const app = store()
        const markup = renderToString(tree(app, false, () => {}))
        const stop = watchGeolocation(app)
        page.geolocation.watches[0]!.success(position(7))
        const container = document.createElement("div")
        container.innerHTML = markup
        document.body.append(container)
        const rendered: string[] = []
        const recoverable: unknown[] = []
        let root: Root | undefined
        try {
            await act(async () => {
                root = hydrateRoot(container, tree(app, false, value => rendered.push(value)), {
                    onRecoverableError: error => recoverable.push(error),
                })
            })
            expect(recoverable).toEqual([])
            expect(rendered[0]).toBe("idle|prompt|none")
            expect(rendered.at(-1)).toBe("active|unsupported|7")
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }
        stop()
        app.dispose()
    })

    test("server renders of fresh request stores are deterministic and inert", () => {
        page = installGeolocation()
        const first = store()
        const second = store()
        const a = renderToString(tree(first, true, () => {}))
        expect(renderToString(tree(second, true, () => {}))).toBe(a)
        expect(page.geolocation.watches).toEqual([])
        first.dispose()
        second.dispose()
    })
})
