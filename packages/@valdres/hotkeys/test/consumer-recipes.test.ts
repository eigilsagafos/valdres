// Application-side recipes on the UNCHANGED candidate API (proto/hotkeys).
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { atom, selector, store, type Store, type Transaction } from "valdres"
import { bindHotkey } from "../src/index"
import {
    lastKeyDownAtom,
    isCodePressedSelector,
    preventKeyDownDefault,
    type KeyDown,
} from "@valdres/browser-keyboard"
import {
    installKeyboardHarness,
    setPlatform,
    type KeyboardHarness,
} from "./helpers"

let kb: KeyboardHarness
beforeEach(() => {
    setPlatform("Linux x86_64")
    kb = installKeyboardHarness()
})
afterEach(() => kb.restore())
const causes = (e: unknown) =>
    ((e as { causes?: unknown[] }).causes ?? []).map(String).join()

// ---- Application operations: tx-aware core + standalone wrapper -------------
const zoom = atom(1)
const zoomBy = (tx: Transaction, factor: number) =>
    tx.set(zoom, Math.min(8, Math.max(0.125, tx.get(zoom) * factor)))
const zoomByNow = (s: Store, factor: number) => s.txn(tx => zoomBy(tx, factor)) // toolbar, menus, tests

describe("transaction-aware operations", () => {
    test("commands call the tx-aware form; the standalone wrapper opens its own transaction elsewhere", () => {
        const app = store()
        bindHotkey(app, ["Ctrl+=", "Ctrl++"], tx => zoomBy(tx, 2), {
            preventDefault: true,
        })
        bindHotkey(app, "Ctrl+-", tx => zoomBy(tx, 0.5), {
            preventDefault: true,
        })
        kb.down("ControlLeft", "Control")
        kb.down("Equal", "=")
        kb.down("NumpadAdd", "+") // numpad plus produces "+"
        kb.down("ShiftLeft", "Shift")
        kb.down("Equal", "+") // Ctrl+Shift+= also produces "+"
        kb.up("ShiftLeft", "Shift")
        kb.down("Minus", "-")
        expect(app.get(zoom)).toBe(4)
        zoomByNow(app, 2) // outside any settlement
        expect(app.get(zoom)).toBe(8)
        app.dispose()
    })

    test("exact zoom migration: ZoomIn/ZoomOut repeat and prevent; ZoomReset neither repeats nor prevents (as today)", () => {
        const app = store()
        bindHotkey(app, "Mod+=", tx => zoomBy(tx, 2), {
            repeat: true,
            preventDefault: true,
        }) // ZoomIn
        bindHotkey(app, "Mod+-", tx => zoomBy(tx, 0.5), {
            repeat: true,
            preventDefault: true,
        }) // ZoomOut
        bindHotkey(app, "Mod+0", tx => tx.set(zoom, 1)) // ZoomReset: old defaults (repeat off, no preventDefault)
        kb.down("ControlLeft", "Control")
        const zoomIn = [
            kb.down("Equal", "="),
            kb.down("Equal", "=", { repeat: true }),
        ]
        expect(app.get(zoom)).toBe(4)
        kb.up("Equal", "=")
        const reset = [
            kb.down("Digit0", "0"),
            kb.down("Digit0", "0", { repeat: true }),
        ]
        app.set(zoom, 3)
        kb.down("Digit0", "0", { repeat: true }) // repeat: not run
        expect(app.get(zoom)).toBe(3)
        expect(zoomIn.map(e => e.defaultPrevented)).toEqual([true, true])
        expect(reset.map(e => e.defaultPrevented)).toEqual([false, false])
        app.dispose()
    })

    test("calling the standalone wrapper from a command is rejected, rolled back and reported", () => {
        const app = store()
        bindHotkey(app, "z", () => zoomByNow(app, 2))
        kb.down("KeyZ", "z")
        expect(app.get(zoom)).toBe(1)
        expect(causes(kb.reported()[0])).toContain("TransactionPhaseError")
        app.dispose()
    })
})

// ---- Async clipboard: intent in settle, effect in an ordinary subscriber ----
describe("async effect integration", () => {
    test("the subscriber starts the effect synchronously inside the keydown's dispatch, once per request", async () => {
        const app = store()
        type Request = { sequence: number; selection: string }
        const copyRequest = atom<Request | null>(null)
        const selection = atom("shape-1")
        const copied: string[] = []
        let startedDuringDispatch: boolean[] = []
        const clipboard = {
            writeText: async (text: string) => void copied.push(text),
        }
        bindHotkey(app, "Ctrl+c", (tx, { keyDown }) =>
            tx.set(copyRequest, {
                sequence: keyDown.sequence,
                selection: tx.get(selection),
            }),
        )
        let lastStarted = 0
        app.sub(copyRequest, () => {
            const request = app.get(copyRequest)
            if (request === null || request.sequence <= lastStarted) return
            lastStarted = request.sequence
            // Still inside the native keydown dispatch (user activation is live):
            startedDuringDispatch.push(
                preventKeyDownDefault(app.get(lastKeyDownAtom) as KeyDown),
            )
            void clipboard
                .writeText(request.selection)
                .then(() =>
                    app.txn(
                        tx =>
                            tx.get(copyRequest)?.sequence ===
                                request.sequence && tx.set(copyRequest, null),
                    ),
                )
        })
        kb.down("ControlLeft", "Control")
        kb.down("KeyC", "c")
        kb.down("KeyC", "c", { repeat: true }) // swallowed: no second request
        await Promise.resolve()
        await Promise.resolve()
        expect(copied).toEqual(["shape-1"])
        expect(startedDuringDispatch).toEqual([true])
        expect(app.get(copyRequest)).toBeNull()
        app.dispose()
    })
})

// ---- Hold-to-pan: accepted press + held state, no keyup handler -------------
describe("hold-to-pan", () => {
    const setup = () => {
        const app = store()
        const tool = atom<"select" | "draw">("draw")
        const canvasActive = atom(true)
        // The accepted press: recorded only when Space was eligible at keydown.
        const panPress = atom<KeyDown | null>(null)
        bindHotkey(
            app,
            "Space",
            (tx, { keyDown }) => tx.set(panPress, keyDown),
            {
                enabled: canvasActive,
                preventDefault: true, // first press and its repeats: no page scroll
            },
        )
        // Application-owned: clear the accepted press once Space is no longer held
        // (keyup, focus-loss reset). See hold-and-intents.test.ts for identity checks.
        const spaceHeld = isCodePressedSelector("Space")
        app.sub(spaceHeld, {
            settle: tx => void (!tx.get(spaceHeld) && tx.set(panPress, null)),
        })
        const panning = selector(
            get => get(panPress) !== null && get(spaceHeld),
        )
        const effectiveTool = selector(get =>
            get(panning) ? "hand" : get(tool),
        )
        return { app, tool, canvasActive, panning, effectiveTool }
    }

    test("press, repeats, release: a temporary override; the selected tool never changes", () => {
        const { app, tool, effectiveTool } = setup()
        const seen: string[] = []
        app.sub(effectiveTool, () => seen.push(app.get(effectiveTool)))
        const first = kb.down("Space", " ")
        const repeat = kb.down("Space", " ", { repeat: true })
        kb.up("Space", " ")
        expect([first.defaultPrevented, repeat.defaultPrevented]).toEqual([
            true,
            true,
        ])
        expect(seen).toEqual(["hand", "draw"])
        expect(app.get(tool)).toBe("draw")
        app.dispose()
    })

    test("focus loss ends the hold; a Space typed into a field never pans; eligibility changes mid-hold do not end it", () => {
        const { app, canvasActive, panning } = setup()
        kb.down("Space", " ")
        kb.blur() // keyup missed: reset clears held keys
        expect(app.get(panning)).toBe(false)
        const input = document.createElement("input")
        document.body.append(input)
        const typed = kb.down("Space", " ", { target: input })
        expect([app.get(panning), typed.defaultPrevented]).toEqual([
            false,
            false,
        ])
        kb.up("Space", " ", { target: input })
        input.remove()
        kb.down("Space", " ")
        app.set(canvasActive, false) // accepted press stays accepted until release
        expect(app.get(panning)).toBe(true)
        kb.up("Space", " ")
        kb.down("Space", " ") // a new press while ineligible is not accepted
        expect(app.get(panning)).toBe(false)
        app.dispose()
    })

    test("CONTRAST: blind keydown/keyup toggles (old DOM-listener style) stick after a missed keyup", () => {
        const app = store()
        const panOn = atom(false)
        const toggle = (e: Event) => {
            const key = e as KeyboardEvent
            if (key.code === "Space" && !key.repeat)
                app.set(panOn, !app.get(panOn))
        }
        document.addEventListener("keydown", toggle)
        document.addEventListener("keyup", toggle)
        kb.down("Space", " ")
        kb.blur() // the keyup is lost (focus left the window)
        kb.down("KeyA", "a")
        document.removeEventListener("keydown", toggle)
        document.removeEventListener("keyup", toggle)
        expect(app.get(panOn)).toBe(true) // stuck in pan mode until the next Space press
        app.dispose()
    })
})

// ---- Active canvas with independent child-Store dispatch --------------------
describe("active canvas", () => {
    test("each canvas Store dispatches independently; only the active one is eligible; hidden/export canvases never are", () => {
        const root = store()
        const activeCanvas = atom<string | null>(null) // root state, inherited
        const canvasId = atom<string | null>(null) // overridden per canvas Store
        const isActive = selector(
            get =>
                get(canvasId) !== null && get(canvasId) === get(activeCanvas),
        )
        const deleted = atom<string[]>([])
        const canvases = ["main", "side", "export"].map(id => {
            const s = root.scope(id)
            s.set(canvasId, id)
            bindHotkey(
                s,
                "Delete",
                tx => tx.set(deleted, [...tx.get(deleted), id]),
                { enabled: isActive },
            )
            return s
        })
        kb.down("Delete", "Delete") // nothing active
        root.set(activeCanvas, "side")
        kb.down("Delete", "Delete")
        root.set(activeCanvas, "main")
        kb.down("Delete", "Delete")
        expect(canvases.map(s => s.get(deleted))).toEqual([
            ["main"],
            ["side"],
            [],
        ])
        root.dispose()
    })
})
