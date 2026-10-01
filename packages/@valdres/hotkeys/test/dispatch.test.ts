import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { atom, selector, store } from "valdres"
import {
    activateHotkeyScope,
    bindHotkey,
    hotkeyScope,
    shortcutSelector,
} from "../src/index"
import { inspectRegistry } from "../src/lib/registry"
import {
    activateKeyboard,
    lastKeyDownAtom,
    pressedCodesSelector,
    preventKeyDownDefault,
} from "@valdres/browser-keyboard"
import {
    counted,
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

const causes = (error: unknown) =>
    ((error as { causes?: unknown[] }).causes ?? []).map(cause => String(cause))

describe("occurrences and matching", () => {
    test("first press runs once; repeats are swallowed unless repeat: true", () => {
        const app = store()
        const once = counted(app, "ArrowDown")
        const each = counted(app, "ArrowUp", { repeat: true })
        kb.down("ArrowDown", "ArrowDown")
        kb.down("ArrowDown", "ArrowDown", { repeat: true })
        kb.down("ArrowDown", "ArrowDown", { repeat: true })
        kb.up("ArrowDown", "ArrowDown")
        kb.down("ArrowUp", "ArrowUp")
        kb.down("ArrowUp", "ArrowUp", { repeat: true })
        expect(once.count()).toBe(1)
        expect(each.count()).toBe(2)
        expect(each.sequences).toEqual([4, 5])
        app.dispose()
    })

    test("held modifiers are compared exactly with the occurrence", () => {
        const app = store()
        const shiftDown = counted(app, "Shift+ArrowDown")
        const plainDown = counted(app, "ArrowDown")
        kb.down("ArrowDown", "ArrowDown") // plain
        kb.up("ArrowDown", "ArrowDown")
        kb.down("ShiftLeft", "Shift") // ArrowDown then Shift: nothing new for Shift+ArrowDown
        expect(shiftDown.count()).toBe(0)
        kb.down("ArrowDown", "ArrowDown") // Shift held
        kb.up("ArrowDown", "ArrowDown")
        kb.down("ControlLeft", "Control")
        kb.down("ArrowDown", "ArrowDown") // Ctrl+Shift+ArrowDown matches neither
        expect(shiftDown.count()).toBe(1)
        expect(plainDown.count()).toBe(1)
        app.dispose()
    })

    test("modifier order and spelling do not matter; Mod follows the platform", () => {
        expect(shortcutSelector("Shift+Ctrl+z")).toBe(
            shortcutSelector("control+SHIFT+Z"),
        )
        expect(shortcutSelector("Mod+z")).toBe(shortcutSelector("Ctrl+z"))
        setPlatform("MacIntel")
        expect(shortcutSelector("Mod+z")).toBe(shortcutSelector("Meta+z"))
        const app = store()
        const redo = counted(app, "Mod+Shift+Z")
        kb.down("ShiftLeft", "Shift")
        kb.down("MetaLeft", "Meta")
        kb.down("KeyZ", "Z") // Shift before Meta, uppercase key
        kb.up("KeyZ", "Z")
        kb.up("ShiftLeft", "Shift")
        kb.up("MetaLeft", "Meta")
        kb.down("MetaLeft", "Meta")
        kb.down("ShiftLeft", "Shift")
        kb.down("KeyZ", "z") // Meta before Shift
        expect(redo.count()).toBe(2)
        app.dispose()
    })

    test("key tokens follow the layout; code tokens follow the physical key", () => {
        const app = store()
        const byKey = counted(app, "Ctrl+z")
        const byCode = counted(app, "Ctrl+KeyZ")
        kb.down("ControlLeft", "Control")
        kb.down("KeyY", "z") // QWERTZ: the key labelled Z sits at KeyY
        kb.up("KeyY", "z")
        expect([byKey.count(), byCode.count()]).toEqual([1, 0])
        kb.down("KeyZ", "y") // the physical KeyZ produces "y"
        expect([byKey.count(), byCode.count()]).toEqual([1, 1])
        app.dispose()
    })

    test("shifted symbols match without naming Shift; naming it is rejected", () => {
        const app = store()
        const help = counted(app, "?")
        kb.down("ShiftLeft", "Shift")
        kb.down("Slash", "?")
        expect(help.count()).toBe(1)
        expect(() => bindHotkey(app, "Shift+?", () => {})).toThrow(SyntaxError)
        expect(() => bindHotkey(app, "Hyper+k", () => {})).toThrow(SyntaxError)
        app.dispose()
    })

    test("IME composition keydowns are never occurrences", () => {
        const app = store()
        const k = counted(app, "k")
        kb.down("KeyK", "k", { isComposing: true })
        kb.down("KeyK", "Process", { keyCode: 229 })
        expect(k.count()).toBe(0)
        kb.down("KeyK", "k")
        expect(k.count()).toBe(1)
        app.dispose()
    })

    test("text-entry targets are skipped unless editable: true, and fall through", () => {
        const app = store()
        const input = document.createElement("input")
        const checkbox = Object.assign(document.createElement("input"), {
            type: "checkbox",
        })
        const editor = document.createElement("div")
        editor.contentEditable = "true"
        document.body.append(input, checkbox, editor)
        const plain = counted(app, "Escape", { priority: 1 })
        const inFields = counted(app, "Escape", { editable: true })
        kb.down("Escape", "Escape", { target: input })
        kb.down("Escape", "Escape", { target: editor })
        expect([plain.count(), inFields.count()]).toEqual([0, 2])
        kb.down("Escape", "Escape", { target: checkbox })
        kb.down("Escape", "Escape")
        expect([plain.count(), inFields.count()]).toEqual([2, 2])
        input.remove(), checkbox.remove(), editor.remove()
        app.dispose()
    })
})

describe("occurrence-time eligibility (no replay)", () => {
    test("late registration, then eligibility toggles BEFORE any reset: nothing runs", () => {
        const app = store()
        const enabled = atom(true)
        activateKeyboard() // the hub observes the keydown below, so it is retained
        kb.down("KeyK", "k") // before registration
        expect(app.get(lastKeyDownAtom)?.sequence).toBe(1)
        const k = counted(app, "k", { enabled })
        expect(k.count()).toBe(0) // registration does not fire
        app.set(enabled, false)
        app.set(enabled, true) // the coordinator's pitfall
        expect(k.count()).toBe(0)
        kb.down("KeyK", "k", { repeat: true }) // still held: a repeat is swallowed
        kb.up("KeyK", "k")
        kb.down("KeyK", "k")
        expect(k.count()).toBe(1)
        expect(k.sequences).toEqual([3])
        app.dispose()
    })

    test("a keydown while disabled stays unhandled when enabled later", () => {
        const app = store()
        const enabled = atom(false)
        const k = counted(app, "k", { enabled })
        kb.down("KeyK", "k")
        app.set(enabled, true)
        expect(k.count()).toBe(0)
        kb.up("KeyK", "k")
        kb.down("KeyK", "k")
        expect(k.count()).toBe(1)
        app.dispose()
    })

    test("scope activation, keyup, reset, resubscription and unrelated writes never replay", () => {
        const app = store()
        const modal = hotkeyScope({ name: "modal" })
        const unrelated = atom(0)
        const k = counted(app, "k", { scope: modal })
        const base = counted(app, "j")
        kb.down("KeyK", "k")
        kb.down("KeyJ", "j")
        const release = activateHotkeyScope(app, modal) // after K
        kb.up("KeyK", "k")
        app.set(unrelated, 1)
        const extra = app.sub(lastKeyDownAtom, () => {}) // resubscription churn
        extra()
        const again = counted(app, "k", { scope: modal })
        kb.blur()
        app.set(unrelated, 2)
        expect([k.count(), again.count(), base.count()]).toEqual([0, 0, 1])
        again.stop()
        kb.down("KeyK", "k")
        expect(k.count()).toBe(1)
        release()
        app.dispose()
    })
})

describe("attempts and failures", () => {
    test("a throwing command rolls back its writes, is reported, never retried and never falls through", () => {
        const app = store()
        const touched = atom("untouched")
        const lower = counted(app, "s")
        let attempts = 0
        bindHotkey(
            app,
            "s",
            tx => {
                attempts++
                tx.set(touched, "written")
                throw new Error("save exploded")
            },
            { priority: 1, preventDefault: true },
        )
        const event = kb.down("KeyS", "s")
        expect(attempts).toBe(1)
        expect(app.get(touched)).toBe("untouched")
        expect(lower.count()).toBe(0)
        expect(event.defaultPrevented).toBe(true) // decided before the command ran
        const [reported] = kb.reported()
        expect((reported as Error).name).toBe("SubscriberNotificationError")
        expect(causes(reported).join()).toContain("save exploded")
        app.set(touched, "later write") // unrelated change: no retry
        expect(attempts).toBe(1)
        kb.down("KeyS", "s", { repeat: true }) // repeat: swallowed (prevented), not run
        kb.up("KeyS", "s")
        kb.down("KeyS", "s") // a new occurrence is a new attempt
        expect(attempts).toBe(2)
        app.dispose()
    })

    test("a promise-returning command is rejected and rolled back", () => {
        const app = store()
        const touched = atom(0)
        bindHotkey(app, "p", tx => {
            tx.set(touched, 1)
            return Promise.resolve() as unknown as void
        })
        kb.down("KeyP", "p")
        expect(app.get(touched)).toBe(0)
        expect(causes(kb.reported()[0]).join()).toContain("must be synchronous")
        app.dispose()
    })
})

describe("priority, conflicts and scopes", () => {
    test("highest priority wins; a disabled winner falls through; equal priority is a conflict", () => {
        const app = store()
        const topEnabled = atom(true)
        const top = counted(app, "Escape", { priority: 2, enabled: topEnabled })
        const middle = counted(app, "Escape", { priority: 1 })
        const bottom = counted(app, "Escape")
        kb.down("Escape", "Escape")
        app.set(topEnabled, false)
        kb.down("Escape", "Escape")
        expect([top.count(), middle.count(), bottom.count()]).toEqual([1, 1, 0])
        const rival = counted(app, "Esc", { priority: 1 })
        const event = kb.down("Escape", "Escape")
        expect([middle.count(), rival.count(), bottom.count()]).toEqual([
            1, 0, 0,
        ])
        expect(event.defaultPrevented).toBe(false)
        expect(causes(kb.reported()[0]).join()).toContain("HotkeyConflictError")
        app.dispose()
    })

    test("an active scope outranks the base layer; an exclusive one blocks it entirely", () => {
        const app = store()
        const panel = hotkeyScope({ name: "panel", priority: 5 })
        const modal = hotkeyScope({
            name: "modal",
            priority: 10,
            exclusive: true,
        })
        const baseEscape = counted(app, "Escape", { priority: 100 })
        const baseK = counted(app, "k")
        const panelEscape = counted(app, "Escape", { scope: panel })
        const modalEnter = counted(app, "Enter", { scope: modal })
        kb.down("Escape", "Escape") // panel inactive
        const releasePanel = activateHotkeyScope(app, panel)
        kb.down("Escape", "Escape") // panel layer beats base priority 100
        kb.down("KeyK", "k") // non-exclusive: base keys still work
        const releaseModal = activateHotkeyScope(app, modal)
        const releaseModal2 = activateHotkeyScope(app, modal) // counted activations
        kb.down("KeyK", "k")
        kb.down("Escape", "Escape")
        kb.down("Enter", "Enter")
        releaseModal()
        kb.down("KeyK", "k") // still one activation
        releaseModal2()
        kb.down("KeyK", "k")
        releasePanel()
        expect(app.get(modal.active)).toBe(false)
        expect([
            baseEscape.count(),
            panelEscape.count(),
            baseK.count(),
            modalEnter.count(),
        ]).toEqual([1, 1, 2, 1])
        app.dispose()
    })

    test("earlier commands in the same settlement do not change this store's decision, but other handlers see latest state", () => {
        const app = store()
        const enabled = atom(true)
        // A raw settle handler registered first disables the hotkey for this very keydown.
        app.sub(lastKeyDownAtom, { settle: tx => tx.set(enabled, false) })
        const k = counted(app, "k", { enabled })
        kb.down("KeyK", "k")
        expect(k.count()).toBe(0) // documented: dispatch reads latest state
        app.dispose()
    })
})

describe("lifetime", () => {
    test("registration churn leaves nothing behind; disposal inside a command is deferred", async () => {
        const app = store()
        for (let i = 0; i < 100; i++)
            bindHotkey(app, ["a", "Mod+b"], () => {})()
        expect(inspectRegistry(app)).toEqual({
            bindings: 0,
            ids: [],
            indexKeys: 0,
            exclusiveScopes: 0,
            dispatching: false,
        })
        expect(kb.invalidators()).toBe(0)
        let stop = () => {}
        stop = bindHotkey(app, "x", () => stop())
        expect(kb.invalidators()).toBe(1)
        kb.down("KeyX", "x")
        expect(kb.reported()).toEqual([])
        expect(inspectRegistry(app).bindings).toBe(0)
        expect(inspectRegistry(app).dispatching).toBe(true) // unsubscribe is forbidden mid-settlement
        await Promise.resolve()
        expect(inspectRegistry(app).dispatching).toBe(false)
        expect(kb.invalidators()).toBe(0)
        app.dispose()
    })

    test("registering inside a command is captured-store work and is rejected", () => {
        const app = store()
        bindHotkey(app, "r", () => void bindHotkey(app, "q", () => {}))
        kb.down("KeyR", "r")
        expect(causes(kb.reported()[0]).join()).toContain(
            "TransactionPhaseError",
        )
        expect(inspectRegistry(app).bindings).toBe(1)
        app.dispose()
    })

    test("independent stores and scopes decide independently", () => {
        const one = store()
        const two = store()
        const child = one.scope("panel")
        const a = counted(one, "a")
        const b = counted(two, "a")
        const c = counted(child, "a")
        bindHotkey(
            two,
            "a",
            () => {
                throw new Error("two exploded")
            },
            { priority: 1 },
        )
        const event = kb.down("KeyA", "a")
        expect([a.count(), b.count(), child.get(c.runs)]).toEqual([1, 0, 1])
        expect(one.get(c.runs)).toBe(0) // the child's write stayed in the child
        expect(event.defaultPrevented).toBe(false)
        one.dispose()
        two.dispose()
    })

    test("disposing the store first: disposers stay safe and the hub registration goes", () => {
        const app = store()
        const k = counted(app, "k")
        const modal = hotkeyScope()
        const release = activateHotkeyScope(app, modal)
        expect(kb.invalidators()).toBe(1)
        app.dispose()
        expect(kb.invalidators()).toBe(0)
        expect(() => (k.stop(), release())).not.toThrow()
        expect(() => bindHotkey(app, "k", () => {})).toThrow()
    })
})

describe("coherence and native cancellation", () => {
    test("ordinary subscribers see the key state and the command result in one notification", () => {
        const app = store()
        const saved = atom(0)
        bindHotkey(app, "Ctrl+s", tx => tx.set(saved, tx.get(saved) + 1))
        const view = selector(
            get => `${get(pressedCodesSelector).join("+")}|saved=${get(saved)}`,
        )
        const seen: string[] = []
        app.sub(view, () => seen.push(app.get(view)))
        kb.down("ControlLeft", "Control")
        kb.down("KeyS", "s")
        expect(seen).toEqual([
            "ControlLeft|saved=0",
            "ControlLeft+KeyS|saved=1",
        ])
        app.dispose()
    })

    test("preventDefault only for a handled, live occurrence; idempotent across stores", () => {
        const one = store()
        const two = store()
        bindHotkey(one, "Ctrl+s", () => {}, { preventDefault: true })
        bindHotkey(two, "Ctrl+s", () => {}, { preventDefault: true })
        const disabled = atom(false)
        bindHotkey(one, "Ctrl+p", () => {}, {
            preventDefault: true,
            enabled: disabled,
        })
        kb.down("ControlLeft", "Control")
        const handled = kb.down("KeyS", "s")
        const skipped = kb.down("KeyP", "p")
        expect([handled.defaultPrevented, skipped.defaultPrevented]).toEqual([
            true,
            false,
        ])
        // A retained occurrence cannot be cancelled after its dispatch.
        const retained = one.get(lastKeyDownAtom)!
        expect(preventKeyDownDefault(retained)).toBe(false)
        one.dispose()
        two.dispose()
    })

    test("a keydown dispatched from a subscriber is applied after its own dispatch: it runs but cannot be cancelled", () => {
        const app = store()
        const nested: KeyboardEvent[] = []
        const n = counted(app, "n", { preventDefault: true })
        const stop = app.sub(lastKeyDownAtom, () => {
            if (app.get(lastKeyDownAtom)?.code === "KeyM")
                nested.push(kb.down("KeyN", "n"))
        })
        kb.down("KeyM", "m")
        expect(n.count()).toBe(1)
        expect(nested[0]!.defaultPrevented).toBe(false)
        stop()
        app.dispose()
    })
})
