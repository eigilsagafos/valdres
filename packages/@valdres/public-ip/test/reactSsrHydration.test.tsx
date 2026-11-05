import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { forgetPublicIp } from "../src/lib/publicIpRecord"
import {
    publicIpStatusAtom,
    publicIpValueAtom,
    requestPublicIp,
} from "../src/index"
import { installFetch, V4, type FetchHarness } from "./setup/fetchHarness"
;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let net: FetchHarness | undefined
afterEach(() => {
    forgetPublicIp()
    net?.restore()
    net = undefined
})

const Ip = ({ onRender }: { onRender: (value: string) => void }) => {
    const text = `${useValue(publicIpStatusAtom)}|${useValue(publicIpValueAtom) ?? "-"}`
    onRender(text)
    return <span>{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Ip onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the idle seed without requesting, hydrates cleanly, then shows the live address", async () => {
        net = installFetch()
        // The page already knows its address; the server never does.
        const known = requestPublicIp()
        net.calls[0]!.respond(V4)
        await known
        const app = store()
        const markup = renderToString(tree(app, () => {}))
        expect(markup).toContain(">idle|-<")

        const container = document.createElement("div")
        container.innerHTML = markup
        document.body.append(container)
        const rendered: string[] = []
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
            expect(rendered[0]).toBe("idle|-")
            expect(rendered.at(-1)).toBe(`ready|${V4}`)
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }
        expect(net.calls).toHaveLength(1)
        app.dispose()
    })
})
