import { afterEach, describe, expect, test } from "bun:test"
import { act, type ReactElement } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { store, type Store } from "valdres"
import { Provider, useValue } from "valdres-react"
import {
    forgetBandwidth,
    useMeasurementRunner,
} from "../src/lib/measurementRecord"
import {
    downloadSpeedAtom,
    measureBandwidth,
    measurementStatusAtom,
} from "../src/index"
import { scriptedRunner } from "./setup/harness"
;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
    forgetBandwidth()
    useMeasurementRunner()
})

const Speed = ({ onRender }: { onRender: (value: string) => void }) => {
    const text = `${useValue(measurementStatusAtom)}|${useValue(downloadSpeedAtom) ?? "-"}`
    onRender(text)
    return <span>{text}</span>
}

const tree = (app: Store, onRender: (value: string) => void): ReactElement => (
    <Provider store={app}>
        <Speed onRender={onRender} />
    </Provider>
)

describe("React server render and hydration", () => {
    test("renders the idle seed without measuring, hydrates cleanly, then shows the live result", async () => {
        const net = scriptedRunner()
        useMeasurementRunner(net.runner)
        // The page measured already; the server never does.
        const measured = measureBandwidth()
        net.runs[0]!.complete({ downloadMbps: 42 })
        await measured
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
            expect(rendered.at(-1)).toBe("ready|42")
        } finally {
            if (root !== undefined) await act(async () => root!.unmount())
            container.remove()
        }
        expect(net.runs).toHaveLength(1)
        app.dispose()
    })
})
