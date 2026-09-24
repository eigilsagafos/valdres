import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { StrictMode, useLayoutEffect, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import {
    atom,
    externalAtom,
    selector,
    store,
    type State,
    type Store,
} from "valdres"
import { Provider } from "../src/Provider"
import { useValue } from "../src/useValue"

// Real event dispatch and React's own scheduling; no `act` batching.
let previousActEnvironment: unknown
beforeAll(() => {
    const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }
    previousActEnvironment = scope.IS_REACT_ACT_ENVIRONMENT
    scope.IS_REACT_ACT_ENVIRONMENT = false
})
afterAll(() => {
    ;(
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }
    ).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
})

const settle = async () => {
    for (let index = 0; index < 3; index++)
        await new Promise(resolve => setTimeout(resolve, 5))
}

type Path = "document listener" | "React onKeyDown"
type ObserverOrder = "observer before mount" | "observer after mount"

const scenario = async (path: Path, order: ObserverOrder, strict: boolean) => {
    // One ExternalAtom snapshot: the key and an occurrence sequence.
    let snapshot = Object.freeze({ key: "", seq: 0 })
    let live: Event | undefined
    const listeners = new Set<() => void>()
    const publish = (event: Event, key: string) => {
        snapshot = Object.freeze({ key, seq: snapshot.seq + 1 })
        live = event
        try {
            for (const invalidate of [...listeners]) invalidate()
        } finally {
            live = undefined
        }
    }
    const onDocumentKey = (event: Event) =>
        publish(event, (event as KeyboardEvent).key)
    if (path === "document listener")
        document.addEventListener("keydown", onDocumentKey)
    const keys = externalAtom({
        getSnapshot: () => snapshot,
        subscribe(invalidate) {
            listeners.add(invalidate)
            return () => void listeners.delete(invalidate)
        },
    })
    const key = selector(get => get(keys).key)
    const saving = atom(false)
    const saves = atom(0)
    const dispatch = selector(get => {
        const current = get(keys)
        return Object.freeze({
            seq: current.seq,
            save: current.key === "s" && !get(saving),
        })
    })
    const target: Store = store()
    let lastSeq = target.get(dispatch).seq
    target.react(dispatch, tx => {
        const current = tx.get(dispatch)
        if (current.seq === lastSeq) return
        lastSeq = current.seq
        if (!current.save) return
        live?.preventDefault()
        tx.set(saving, true)
        tx.update(saves, count => count + 1)
    })
    const combined = selector(get => [get(key), get(saving), get(saves)])
    const observed: unknown[] = []
    const observe = () =>
        target.sub(combined, () => observed.push(target.get(combined)))
    if (order === "observer before mount") observe()

    const renders: unknown[] = []
    const commits: unknown[] = []
    const View = () => {
        const k = useValue(key)
        const s = useValue(saving)
        const n = useValue(saves)
        renders.push([k, s, n])
        useLayoutEffect(() => {
            commits.push([k, s, n])
        })
        return (
            <div
                id="target"
                tabIndex={0}
                onKeyDown={
                    path === "React onKeyDown"
                        ? event => publish(event.nativeEvent, event.key)
                        : undefined
                }
            >{`${k}|${s}|${n}`}</div>
        )
    }
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    const app: ReactNode = (
        <Provider store={target}>
            <View />
        </Provider>
    )
    root.render(strict ? <StrictMode>{app}</StrictMode> : app)
    await settle()
    if (order === "observer after mount") observe()
    renders.length = 0
    commits.length = 0

    const element = container.querySelector("#target") as HTMLElement
    const notCanceled = (
        path === "document listener" ? document : element
    ).dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "s",
            bubbles: true,
            cancelable: true,
        }),
    )
    const rendersDuringDispatch = renders.length
    await settle()
    const result = {
        notCanceled,
        rendersDuringDispatch,
        renders: renders.length,
        commits: [...commits],
        observed: [...observed],
        dom: element.textContent,
    }
    root.unmount()
    container.remove()
    document.removeEventListener("keydown", onDocumentKey)
    return result
}

describe("valdres-react with Store.react", () => {
    for (const strict of [false, true])
        for (const path of [
            "document listener",
            "React onKeyDown",
        ] as const satisfies readonly Path[])
            for (const order of [
                "observer before mount",
                "observer after mount",
            ] as const satisfies readonly ObserverOrder[])
                test(`${strict ? "StrictMode " : ""}${path}, ${order}: one coherent commit`, async () => {
                    const result = await scenario(path, order, strict)

                    expect(result.notCanceled).toBe(false)
                    expect(result.rendersDuringDispatch).toBe(0)
                    expect(result.observed).toEqual([["s", true, 1]])
                    // No intermediate [s, false, 0] ever reaches committed UI.
                    expect(result.commits).toEqual([["s", true, 1]])
                    // Render attempts are not commits: StrictMode doubles them.
                    expect(result.renders).toBe(strict ? 2 : 1)
                    expect(result.dom).toBe("s|true|1")
                })
})

// Keep State imported for readers extending the fixture.
export type Trigger = State<unknown>
