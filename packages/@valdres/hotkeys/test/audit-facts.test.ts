// Runtime facts the ShiftX audit reconciliation depends on (candidate API, unchanged).
import { afterEach, beforeEach, expect, test } from "bun:test"
import { atom, selector, store } from "valdres"
import { bindHotkey } from "../src/index"
import {
    isCodePressedSelector,
    isKeyPressedSelector,
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

test("a command dispatched in a child scope writes root state through tx.scope(root)", () => {
    const root = store()
    const draft = root.scope("draft")
    const panels = atom<string[]>([])
    bindHotkey(draft, "Ctrl+.", tx => tx.scope(root).set(panels, ["inspector"]))
    kb.down("ControlLeft", "Control")
    kb.down("Period", ".")
    expect(root.get(panels)).toEqual(["inspector"])
    expect(kb.reported()).toEqual([])
    root.dispose()
})

test("a store in ANOTHER tree cannot be written inside the command", () => {
    const app = store()
    const other = store() // e.g. a separate global/escape-stack Store
    const flag = atom(false)
    bindHotkey(app, "q", tx => tx.scope(other).set(flag, true))
    kb.down("KeyQ", "q")
    expect(other.get(flag)).toBe(false)
    expect(causes(kb.reported()[0])).toContain("different StoreTree")
    app.dispose()
    other.dispose()
})

test("a legacy operation that opens its own transaction: synchronous call from a subscriber is rejected; a microtask call works", async () => {
    const app = store()
    const steps = atom<string[]>([])
    const duplicateNow = () =>
        app.txn(tx => tx.set(steps, [...tx.get(steps), "copy"])) // opens its own txn
    const request = atom(0)
    bindHotkey(
        app,
        "Ctrl+d",
        (tx, { keyDown }) => tx.set(request, keyDown.sequence),
        { preventDefault: true },
    )
    let syncError = ""
    let handled = 0
    const stop = app.sub(request, () => {
        try {
            duplicateNow()
        } catch (e) {
            syncError = (e as Error).name
        }
    })
    kb.down("ControlLeft", "Control")
    const event = kb.down("KeyD", "d")
    expect(syncError).not.toBe("") // writing during notification is rejected
    expect(app.get(steps)).toEqual([])
    stop()
    app.sub(request, () => {
        const sequence = app.get(request)
        if (sequence <= handled) return
        handled = sequence
        queueMicrotask(duplicateNow) // same timing as ShiftX's v1 compat layer
    })
    kb.up("KeyD", "d")
    const second = kb.down("KeyD", "d")
    await Promise.resolve()
    expect(app.get(steps)).toEqual(["copy"])
    expect([event.defaultPrevented, second.defaultPrevented]).toEqual([
        true,
        true,
    ])
    console.log("SYNC-SUBSCRIBER-WRITE", syncError)
    app.dispose()
})

test("d+e+v (three held letters) as an application predicate over held state", () => {
    const app = store()
    const devOpen = atom(false)
    const deHeld = selector(
        get => get(isKeyPressedSelector("d")) && get(isKeyPressedSelector("e")),
    )
    bindHotkey(app, "v", tx => tx.set(devOpen, true), { enabled: deHeld })
    kb.down("KeyV", "v")
    kb.up("KeyV", "v")
    expect(app.get(devOpen)).toBe(false)
    kb.down("KeyD", "d")
    kb.down("KeyE", "e")
    kb.down("KeyV", "v")
    expect(app.get(devOpen)).toBe(true)
    app.dispose()
})

test("Space as a toggle-while-held override that preserves today's flip semantics, ended by keyup in an input", () => {
    const app = store()
    const mode = atom<"selection" | "hand">("hand")
    const press = atom<{ code: string; timeStamp: number } | null>(null)
    bindHotkey(app, "Space", (tx, { keyDown }) => tx.set(press, keyDown), {
        preventDefault: true,
    })
    // held-state check via the keyboard's pressed keys
    const spaceHeld = isCodePressedSelector("Space")
    app.sub(spaceHeld, {
        settle: tx => void (!tx.get(spaceHeld) && tx.set(press, null)),
    }) // application clears
    const held = selector(get => get(press) !== null && get(spaceHeld))
    const effectiveMode = selector(get =>
        get(held) ? (get(mode) === "hand" ? "selection" : "hand") : get(mode),
    )
    const input = document.createElement("input")
    document.body.append(input)
    kb.down("Space", " ")
    expect(app.get(effectiveMode)).toBe("selection") // flipped while held
    kb.down("Space", " ", { repeat: true })
    kb.up("Space", " ", { target: input }) // focus moved into an input mid-hold
    expect(app.get(effectiveMode)).toBe("hand") // not stuck
    input.remove()
    app.dispose()
})
