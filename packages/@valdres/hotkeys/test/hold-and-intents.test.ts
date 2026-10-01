// Targeted checks for the final proposal: hold identity and intent bridges.
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { atom, selector, store, type Store } from "valdres"
import { bindHotkey } from "../src/index"
import {
    isCodePressedSelector,
    pressedKeysSelector,
    type KeyDown,
} from "@valdres/browser-keyboard"
import {
    installKeyboardHarness,
    setPlatform,
    type KeyboardHarness,
} from "./helpers"

let kb: KeyboardHarness
let input: HTMLInputElement
beforeEach(() => {
    setPlatform("Linux x86_64")
    kb = installKeyboardHarness()
    input = document.createElement("input")
    document.body.append(input)
})
afterEach(() => {
    input.remove()
    kb.restore()
})
/** Every event constructed inside `fn` gets the same timeStamp. */
const sameTimestamp = <T>(fn: () => T): T => {
    const spy = spyOn(performance, "now").mockReturnValue(1000)
    try {
        return fn()
    } finally {
        spy.mockRestore()
    }
}

describe("hold: identity by timeStamp (previous recipe)", () => {
    test("DEFECT: a released accepted press reactivates when a rejected press has the same timeStamp", () => {
        const app = store()
        const accepts = atom(true)
        const panPress = atom<KeyDown | null>(null)
        bindHotkey(
            app,
            "Space",
            (tx, { keyDown }) => tx.set(panPress, keyDown),
            { enabled: accepts },
        )
        const panning = selector(get => {
            const p = get(panPress)
            return (
                p !== null &&
                get(pressedKeysSelector).some(
                    k => k.code === p.code && k.timeStamp === p.timeStamp,
                )
            )
        })
        const results = sameTimestamp(() => {
            kb.down("Space", " ") // A accepted
            kb.up("Space", " ")
            kb.down("Space", " ", { target: input }) // B rejected by editable filtering
            const afterEditable = app.get(panning)
            kb.up("Space", " ", { target: input })
            app.set(accepts, false)
            kb.down("Space", " ") // C rejected by eligibility
            return [afterEditable, app.get(panning)]
        })
        expect(results).toEqual([true, true]) // both wrong: A reactivated
        app.dispose()
    })
})

describe("hold: corrected recipe on existing primitives", () => {
    /**
     * Application-owned hold. The accepted press is cleared by the application
     * when the key is no longer held (keyup, focus-loss reset, macOS Meta
     * truncation), so press identity is never needed.
     */
    const createHold = (app: Store, code: string) => {
        const press = atom<KeyDown | null>(null)
        const held = isCodePressedSelector(code)
        const active = selector(get => get(press) !== null && get(held))
        // Owned by the application, for the hold state's lifetime (NOT the binding's).
        const stopClear = app.sub(held, {
            settle: tx => {
                if (!tx.get(held) && tx.get(press) !== null) tx.set(press, null)
            },
        })
        return {
            press,
            active,
            accept: (
                tx: Parameters<Parameters<typeof bindHotkey>[2]>[0],
                keyDown: KeyDown,
            ) => tx.set(press, keyDown),
            /** Feature teardown: stop clearing and drop any hold. Call outside transactions. */
            dispose: () => {
                stopClear()
                app.set(press, null)
            },
        }
    }

    test("identical timeStamps: a rejected press (editable or ineligible) never reactivates a released hold", () => {
        const app = store()
        const accepts = atom(true)
        const hold = createHold(app, "Space")
        bindHotkey(
            app,
            "Space",
            (tx, { keyDown }) => hold.accept(tx, keyDown),
            { enabled: accepts, preventDefault: true },
        )
        const trace = sameTimestamp(() => {
            const t: boolean[] = []
            kb.down("Space", " ")
            t.push(app.get(hold.active)) // A accepted: true
            kb.up("Space", " ")
            t.push(app.get(hold.active)) // released: false
            kb.down("Space", " ", { target: input })
            t.push(app.get(hold.active)) // B rejected (editable): false
            kb.up("Space", " ", { target: input })
            app.set(accepts, false)
            kb.down("Space", " ")
            t.push(app.get(hold.active)) // C rejected (ineligible): false
            return t
        })
        expect(trace).toEqual([true, false, false, false])
        expect(app.get(hold.press)).toBeNull()
        app.dispose()
    })

    test("binding disposed while held: the hold lasts until release, then the application clears it", () => {
        const app = store()
        const hold = createHold(app, "Space")
        const stop = bindHotkey(app, "Space", (tx, { keyDown }) =>
            hold.accept(tx, keyDown),
        )
        sameTimestamp(() => kb.down("Space", " "))
        stop() // binding gone mid-hold
        expect(app.get(hold.active)).toBe(true)
        sameTimestamp(() => {
            kb.up("Space", " ")
            kb.down("Space", " ") // no binding: not accepted
        })
        expect([app.get(hold.active), app.get(hold.press)]).toEqual([
            false,
            null,
        ])
        app.dispose()
    })

    test("feature torn down while held: the application's dispose ends the hold; focus loss ends it too", () => {
        const app = store()
        const hold = createHold(app, "Space")
        const stop = bindHotkey(app, "Space", (tx, { keyDown }) =>
            hold.accept(tx, keyDown),
        )
        kb.down("Space", " ")
        stop()
        hold.dispose()
        expect(app.get(hold.active)).toBe(false)
        const again = createHold(app, "Space")
        bindHotkey(app, "Space", (tx, { keyDown }) => again.accept(tx, keyDown))
        kb.up("Space", " ")
        kb.down("Space", " ")
        kb.blur()
        expect([app.get(again.active), app.get(again.press)]).toEqual([
            false,
            null,
        ])
        app.dispose()
    })
})

describe("intent bridges", () => {
    type Request = { readonly sequence: number }

    test("a retained request atom COALESCES: only the latest value is observed, and nothing is replayed to late subscribers", () => {
        const app = store()
        const request = atom<Request | null>(null)
        const seen: number[] = []
        app.txn(tx => {
            tx.set(request, { sequence: 1 })
            tx.set(request, { sequence: 2 })
        })
        app.sub(request, () => seen.push(app.get(request)!.sequence)) // subscribed after: no catch-up call
        app.txn(tx => {
            tx.set(request, { sequence: 3 })
            tx.set(request, { sequence: 4 })
        })
        expect(seen).toEqual([4])
        app.dispose()
    })

    /** Application helper: run a standalone operation once per new request, after the keydown dispatch. */
    const bridge = <R extends Request>(
        app: Store,
        request: ReturnType<typeof atom<R | null>>,
        run: (request: R) => void,
        onError: (error: unknown, request: R) => void,
    ) => {
        let handled = 0
        let live = true
        // v1 Store has no onDispose (store.mdx documents one: docs drift), so probe instead.
        const storeLive = () => {
            try {
                app.get(request)
                return true
            } catch (error) {
                if ((error as Error).name === "StoreDisposedError") return false
                throw error
            }
        }
        const stop = app.sub(request, () => {
            const current = app.get(request)
            if (current === null || current.sequence <= handled) return // dedupe
            handled = current.sequence
            queueMicrotask(() => {
                if (!live || !storeLive()) return // bridge or store disposed: drop
                try {
                    run(current)
                } catch (error) {
                    onError(error, current)
                }
            })
        })
        return () => {
            live = false
            stop()
        }
    }

    test("dedupe, error handling and disposal for the microtask bridge", async () => {
        const app = store()
        const request = atom<(Request & { op: string }) | null>(null)
        const status = atom<string>("idle")
        const ran: string[] = []
        bindHotkey(
            app,
            "Ctrl+d",
            (tx, { keyDown }) =>
                tx.set(request, {
                    sequence: keyDown.sequence,
                    op: "duplicate",
                }),
            {
                preventDefault: true,
            },
        )
        bindHotkey(app, "Ctrl+e", (tx, { keyDown }) =>
            tx.set(request, { sequence: keyDown.sequence, op: "explode" }),
        )
        const stop = bridge(
            app,
            request,
            r => {
                if (r.op === "explode") throw new Error("operation failed")
                ran.push(r.op)
                app.txn(tx => tx.set(status, `done:${r.op}`)) // the standalone op opens its own transaction
            },
            (error, r) =>
                app.txn(tx =>
                    tx.set(
                        status,
                        `failed:${r.op}:${(error as Error).message}`,
                    ),
                ),
        )
        kb.down("ControlLeft", "Control")
        kb.down("KeyD", "d")
        app.set(request, { ...app.get(request)!, op: "duplicate" }) // unrelated rewrite, same sequence: deduped
        await Promise.resolve()
        expect([ran, app.get(status)]).toEqual([
            ["duplicate"],
            "done:duplicate",
        ])
        kb.down("KeyE", "e")
        await Promise.resolve()
        expect(app.get(status)).toBe("failed:explode:operation failed")
        kb.up("KeyD", "d")
        kb.down("KeyD", "d")
        stop() // disposed before the microtask runs: dropped
        await Promise.resolve()
        expect(ran).toEqual(["duplicate"])
        const stop2 = bridge(
            app,
            request,
            r => void ran.push(r.op),
            () => {},
        )
        kb.up("KeyD", "d")
        kb.down("KeyD", "d")
        app.dispose() // store disposed before the microtask runs: dropped, no throw
        await Promise.resolve()
        expect(ran).toEqual(["duplicate"])
        stop2()
    })
})
