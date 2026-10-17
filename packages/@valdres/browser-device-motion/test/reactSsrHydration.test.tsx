import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { accelerationSelector, motionStatusAtom, permissionAtom } from "../src/index"
import type { DeviceHarness } from "./setup/deviceHarness"
import { installMotion, motionEvent } from "./setup/motionFixtures"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let harness: DeviceHarness | undefined
afterEach(() => {
    harness?.restore()
    harness = undefined
})

const Motion = ({ onRender }: { onRender: (value: string) => void }) => {
    const status = useValue(motionStatusAtom)
    const permission = useValue(permissionAtom)
    const x = useValue(accelerationSelector)?.x ?? "none"
    const text = `${status}|${permission}|${x}`
    onRender(text)
    return <span id="motion">{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Motion onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the server seed without attaching, hydrates cleanly, then goes live", async () => {
        harness = installMotion()
        const app = store()
        const rendered: string[] = []
        const markup = renderToString(tree(app, value => rendered.push(value)))
        expect(markup).toContain(">idle|prompt|none<")
        expect(harness.listeners("devicemotion")).toBe(0)

        const container = document.createElement("div")
        container.innerHTML = markup
        document.body.append(container)
        rendered.length = 0
        const recoverable: unknown[] = []
        let root: Root | undefined
        try {
            await act(async () => {
                root = hydrateRoot(container, tree(app, value => rendered.push(value)), {
                    onRecoverableError: error => recoverable.push(error),
                })
            })
            expect(recoverable).toEqual([])
            expect(rendered[0]).toBe("idle|prompt|none")
            expect(rendered.at(-1)).toBe("active|granted|none")
            expect(harness.listeners("devicemotion")).toBe(1)

            await act(async () => harness!.fire(motionEvent(0.25)))
            expect(container.querySelector("#motion")?.textContent).toBe(
                "active|granted|0.25",
            )
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }
        expect(harness.listeners("devicemotion")).toBe(0)
        app.dispose()
    })
})
