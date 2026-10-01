/**
 * What a store update can learn about, and do to, the native keydown that
 * caused it: the dispatch-time `editable` and `defaultPrevented` snapshots,
 * synchronous cancellation of the live event, and the hub's sequence
 * watermark.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { store } from "valdres"
import {
    activateKeyboard,
    lastKeyDownAtom,
    latestKeyDownSequence,
    preventKeyDownDefault,
    type KeyDown,
} from "../src/index"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "./setup/keyboardHarness"
;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

let kb: KeyboardHarness
const cleanups: (() => void)[] = []
beforeEach(() => {
    kb = installKeyboardHarness()
})
afterEach(() => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup()
    kb.restore()
})
const listen = (
    target: EventTarget,
    listener: (event: KeyboardEvent) => void,
    capture = false,
) => {
    const handler = (event: Event) => listener(event as KeyboardEvent)
    target.addEventListener("keydown", handler, capture)
    cleanups.push(() => target.removeEventListener("keydown", handler, capture))
}
const mount = <E extends Element>(element: E): E => {
    document.body.append(element)
    cleanups.push(() => element.remove())
    return element
}
const cancel = (event: KeyboardEvent) => event.preventDefault()

describe("preventKeyDownDefault", () => {
    test("cancels the live keydown from a settle handler or a subscriber", () => {
        const app = store()
        const results: boolean[] = []
        app.sub(lastKeyDownAtom, {
            settle: tx => {
                const keyDown = tx.get(lastKeyDownAtom)
                if (keyDown?.code === "KeyS")
                    results.push(preventKeyDownDefault(keyDown))
            },
        })
        app.sub(lastKeyDownAtom, () => {
            const keyDown = app.get(lastKeyDownAtom)
            if (keyDown?.code === "KeyP")
                results.push(preventKeyDownDefault(keyDown))
        })
        const saved = kb.down("KeyS", "s")
        const printed = kb.down("KeyP", "p")
        const other = kb.down("KeyO", "o")
        expect(results).toEqual([true, true])
        expect([saved, printed, other].map(e => e.defaultPrevented)).toEqual([
            true,
            true,
            false,
        ])
        app.dispose()
    })

    test("does nothing for a retained keydown, a different keydown, or a non-cancelable event", () => {
        const app = store()
        let other: boolean | undefined
        const stop = app.sub(lastKeyDownAtom, () => {
            const keyDown = app.get(lastKeyDownAtom)!
            other = preventKeyDownDefault({
                ...keyDown,
                sequence: keyDown.sequence + 1,
            })
        })
        const event = kb.down("KeyA", "a")
        const retained = app.get(lastKeyDownAtom) as KeyDown
        expect([
            other,
            preventKeyDownDefault(retained),
            event.defaultPrevented,
        ]).toEqual([false, false, false])
        stop()
        let fixed: boolean | undefined
        app.sub(lastKeyDownAtom, () => {
            fixed = preventKeyDownDefault(app.get(lastKeyDownAtom)!)
        })
        const uncancelable = new KeyboardEvent("keydown", {
            code: "KeyB",
            key: "b",
            bubbles: true,
            cancelable: false,
        })
        document.dispatchEvent(uncancelable)
        expect([fixed, uncancelable.defaultPrevented]).toEqual([false, false])
        app.dispose()
    })

    test("is idempotent across stores and survives a store whose handler throws", () => {
        const failing = store()
        const first = store()
        const second = store()
        failing.sub(lastKeyDownAtom, {
            settle: () => {
                throw new Error("settle exploded")
            },
        })
        const results: boolean[] = []
        for (const app of [first, second])
            app.sub(lastKeyDownAtom, {
                settle: tx =>
                    void results.push(
                        preventKeyDownDefault(tx.get(lastKeyDownAtom)!),
                    ),
            })
        const event = kb.down("KeyS", "s")
        expect(results).toEqual([true, true])
        expect(event.defaultPrevented).toBe(true)
        expect(kb.reported()).toHaveLength(1)
        // The live slot ended with the publication, failure or not.
        expect(preventKeyDownDefault(first.get(lastKeyDownAtom)!)).toBe(false)
        for (const app of [failing, first, second]) app.dispose()
    })

    test("a keydown dispatched from a subscriber is applied after its dispatch: published, not cancellable", () => {
        const app = store()
        const outcomes: string[] = []
        let nested: KeyboardEvent | undefined
        app.sub(lastKeyDownAtom, () => {
            const keyDown = app.get(lastKeyDownAtom)!
            outcomes.push(`${keyDown.code}:${preventKeyDownDefault(keyDown)}`)
            if (keyDown.code === "KeyM") nested = kb.down("KeyN", "n")
        })
        const outer = kb.down("KeyM", "m")
        expect(outcomes).toEqual(["KeyM:true", "KeyN:false"])
        expect([outer.defaultPrevented, nested!.defaultPrevented]).toEqual([
            true,
            false,
        ])
        app.dispose()
    })
})

describe("KeyDown.defaultPrevented: a snapshot taken on arrival", () => {
    test("reflects cancellation by earlier listeners: element, capture, earlier document listeners", () => {
        const app = store()
        app.sub(lastKeyDownAtom, () => {})
        const box = mount(document.createElement("div"))
        listen(box, event => event.code === "KeyE" && cancel(event))
        listen(window, event => event.code === "KeyC" && cancel(event), true)
        const seen = (code: string, key: string, target?: EventTarget) => {
            kb.down(code, key, { target })
            return app.get(lastKeyDownAtom)!.defaultPrevented
        }
        expect([
            seen("KeyE", "e", box),
            seen("KeyC", "c"),
            seen("KeyX", "x"),
        ]).toEqual([true, true, false])
        app.dispose()
    })

    test("document listeners: those added before the keyboard's count, those added after do not", () => {
        listen(document, event => event.code === "KeyB" && cancel(event)) // before activation
        activateKeyboard()
        listen(document, event => event.code === "KeyA" && cancel(event)) // after
        const app = store()
        kb.down("KeyB", "b")
        const before = app.get(lastKeyDownAtom)!.defaultPrevented
        const after = kb.down("KeyA", "a")
        expect([
            before,
            app.get(lastKeyDownAtom)!.defaultPrevented,
            after.defaultPrevented,
        ]).toEqual([true, false, true])
        app.dispose()
    })

    test("a React onKeyDown that cancels is seen; one that does not is not", () => {
        activateKeyboard()
        const host = mount(document.createElement("div"))
        const root = createRoot(host)
        act(() =>
            root.render(
                <div
                    id="menu"
                    tabIndex={0}
                    onKeyDown={event =>
                        event.key === "ArrowDown" && event.preventDefault()
                    }
                />,
            ),
        )
        cleanups.push(() => act(() => root.unmount()))
        const menu = host.querySelector("#menu")!
        const app = store()
        kb.down("ArrowDown", "ArrowDown", { target: menu })
        const claimed = app.get(lastKeyDownAtom)!.defaultPrevented
        kb.down("ArrowUp", "ArrowUp", { target: menu })
        expect([claimed, app.get(lastKeyDownAtom)!.defaultPrevented]).toEqual([
            true,
            false,
        ])
        app.dispose()
    })

    test("a store that cancels never changes the snapshot another store sees", () => {
        const first = store()
        const second = store()
        first.sub(lastKeyDownAtom, {
            settle: tx => void preventKeyDownDefault(tx.get(lastKeyDownAtom)!),
        })
        const views: string[] = []
        second.sub(lastKeyDownAtom, {
            settle: tx => {
                const keyDown = tx.get(lastKeyDownAtom)!
                views.push(`snapshot:${keyDown.defaultPrevented}`)
            },
        })
        const event = kb.down("KeyS", "s")
        expect(views).toEqual(["snapshot:false"])
        expect(event.defaultPrevented).toBe(true)
        expect(first.get(lastKeyDownAtom)).toBe(second.get(lastKeyDownAtom))
        first.dispose()
        second.dispose()
    })

    test("a queued keydown keeps its arrival-time snapshots: later cancellation and lost paths do not leak in", () => {
        const app = store()
        const field = mount(document.createElement("input"))
        const seen: string[] = []
        app.sub(lastKeyDownAtom, () => {
            const keyDown = app.get(lastKeyDownAtom)!
            seen.push(
                `${keyDown.code}:${keyDown.editable}:${keyDown.defaultPrevented}`,
            )
            if (keyDown.code === "KeyM") kb.down("KeyN", "n", { target: field })
        })
        // Added after the hub: cancels the nested keydown after the hub received it.
        listen(document, event => event.code === "KeyN" && cancel(event))
        kb.down("KeyM", "m")
        expect(seen).toEqual(["KeyM:false:false", "KeyN:true:false"])
        app.dispose()
    })
})

describe("latestKeyDownSequence", () => {
    test("counts observed keydowns, repeats included; keyups, IME and resets never lower it", () => {
        expect(latestKeyDownSequence()).toBe(0)
        activateKeyboard()
        kb.down("KeyA", "a")
        kb.down("KeyA", "a", { repeat: true })
        kb.up("KeyA", "a")
        kb.down("KeyB", "b", { isComposing: true })
        expect(latestKeyDownSequence()).toBe(2)
        kb.blur()
        expect(latestKeyDownSequence()).toBe(2)
        kb.down("KeyC", "c")
        expect(latestKeyDownSequence()).toBe(3)
    })

    test("is current while a keydown is still being delivered, when a later store's view is not", () => {
        const first = store()
        const second = store()
        const views: (number | undefined)[] = []
        first.sub(lastKeyDownAtom, () => {
            views.push(
                second.get(lastKeyDownAtom)?.sequence,
                latestKeyDownSequence(),
            )
        })
        second.sub(lastKeyDownAtom, () => {})
        kb.down("KeyK", "k")
        expect(views).toEqual([undefined, 1])
        first.dispose()
        second.dispose()
    })
})
