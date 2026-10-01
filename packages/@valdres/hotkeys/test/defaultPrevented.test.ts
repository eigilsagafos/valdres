/**
 * Keydowns that something had cancelled before the keyboard received them
 * (`KeyDown.defaultPrevented`) are skipped unless a binding opts in. The filter
 * runs before arbitration, and the snapshot predates every store update, so a
 * Valdres store that cancels never suppresses another store.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { activateHotkeyScope, bindHotkey, hotkeyScope } from "../src/index"
import {
    causes,
    counted,
    installKeyboardHarness,
    setPlatform,
    type KeyboardHarness,
} from "./helpers"

let kb: KeyboardHarness
let box: HTMLDivElement
const claim = (event: Event) => event.preventDefault()
beforeEach(() => {
    setPlatform("Linux x86_64")
    kb = installKeyboardHarness()
    box = document.createElement("div")
    box.addEventListener("keydown", claim) // an element handler that claims every key
    document.body.append(box)
})
afterEach(() => {
    box.remove()
    kb.restore()
})

describe("pre-cancelled keydowns", () => {
    test("are skipped by default: nothing runs, nothing is swallowed", () => {
        const app = store()
        const k = counted(app, "k", { preventDefault: true })
        const held = counted(app, "j")
        kb.down("KeyK", "k", { target: box })
        kb.down("KeyJ", "j", { target: box })
        kb.down("KeyJ", "j", { target: box, repeat: true })
        expect([k.count(), held.count()]).toEqual([0, 0])
        kb.down("KeyK", "k")
        expect(k.count()).toBe(1)
        app.dispose()
    })

    test("are filtered before arbitration: an opted-in lower binding runs instead of a higher one", () => {
        const app = store()
        const high = counted(app, "ArrowDown", { priority: 10 })
        const low = counted(app, "ArrowDown", { handleDefaultPrevented: true })
        kb.down("ArrowDown", "ArrowDown", { target: box }) // claimed by the element
        expect([high.count(), low.count()]).toEqual([0, 1])
        kb.down("ArrowDown", "ArrowDown") // not claimed: ordinary precedence
        expect([high.count(), low.count()]).toEqual([1, 1])
        app.dispose()
    })

    test("ties among opted-in bindings still fail closed; the default bindings do not join them", () => {
        const app = store()
        const plain = counted(app, "Enter", { priority: 1 })
        const a = counted(app, "Enter", { handleDefaultPrevented: true })
        const b = counted(app, "Enter", { handleDefaultPrevented: true })
        kb.down("Enter", "Enter", { target: box })
        expect([plain.count(), a.count(), b.count()]).toEqual([0, 0, 0])
        expect(causes(kb.reported()[0])).toContain("HotkeyConflictError")
        kb.down("Enter", "Enter")
        expect([plain.count(), a.count(), b.count()]).toEqual([1, 0, 0])
        app.dispose()
    })

    test("scopes still apply to opted-in bindings", () => {
        const app = store()
        const modal = hotkeyScope({ priority: 5, exclusive: true })
        const base = counted(app, "x", { handleDefaultPrevented: true })
        const scoped = counted(app, "x", {
            scope: modal,
            handleDefaultPrevented: true,
        })
        kb.down("KeyX", "x", { target: box })
        const release = activateHotkeyScope(app, modal)
        kb.down("KeyX", "x", { target: box })
        release()
        expect([base.count(), scoped.count()]).toEqual([1, 1])
        app.dispose()
    })
})

describe("stores do not suppress each other", () => {
    test("a store that cancels does not make another store skip the keydown", () => {
        const first = store()
        const second = store()
        const a = counted(first, "Ctrl+s", { preventDefault: true })
        const b = counted(second, "Ctrl+s")
        kb.down("ControlLeft", "Control")
        const event = kb.down("KeyS", "s")
        expect([a.count(), b.count(), event.defaultPrevented]).toEqual([
            1,
            1,
            true,
        ])
        first.dispose()
        second.dispose()
    })

    test("a store's binding opting in sees the same snapshot as any other store", () => {
        const first = store()
        const second = store()
        const seen: boolean[] = []
        for (const app of [first, second])
            bindHotkey(
                app,
                "q",
                (_, { keyDown }) => void seen.push(keyDown.defaultPrevented),
                {
                    handleDefaultPrevented: true,
                    preventDefault: true,
                },
            )
        kb.down("KeyQ", "q", { target: box })
        kb.down("KeyQ", "q")
        expect(seen).toEqual([true, true, false, false])
        first.dispose()
        second.dispose()
    })
})
