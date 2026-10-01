import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { atom, store } from "valdres"
import { bindHotkey } from "../src/index"
import { lastKeyDownAtom } from "@valdres/browser-keyboard"
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

test("a binding registered from another store's notify mid-delivery does not handle that keydown", () => {
    const a = store()
    const b = store()
    const runs: string[] = []
    let registered = false
    let cutoffView: number | undefined
    // a registers with the hub first, so it is invalidated before b.
    a.sub(lastKeyDownAtom, () => {
        if (registered || a.get(lastKeyDownAtom)?.code !== "KeyK") return
        registered = true
        // b has not been invalidated for this keydown yet.
        cutoffView = b.get(lastKeyDownAtom)?.sequence
        bindHotkey(
            b,
            "k",
            (_, hit) => void runs.push(`late:${hit.keyDown.sequence}`),
        )
    })
    bindHotkey(b, "j", () => {}) // b's dispatcher exists before the keydown
    kb.down("KeyK", "k")
    // b's own committed view is one keydown behind (store-view cutoffs let the
    // late binding run: measured "late:1"); the hub sequence excludes it.
    expect(cutoffView).toBeUndefined()
    expect(runs).toEqual([])
    kb.up("KeyK", "k")
    kb.down("KeyK", "k")
    expect(runs).toEqual(["late:2"])
    a.dispose()
    b.dispose()
})

test("domains: root and child-scope bindings both run; binding on the root and writing through tx.scope(child) shares one domain", () => {
    const root = store()
    const child = root.scope("editor")
    const log: string[] = []
    const closed = atom(false)
    // Independent domains: one binding per Store, same shortcut.
    const stopRoot = bindHotkey(root, "Escape", () => void log.push("root"))
    const stopChild = bindHotkey(
        child,
        "Escape",
        tx => (log.push("child"), tx.set(closed, true)),
    )
    kb.down("Escape", "Escape")
    expect(log).toEqual(["root", "child"]) // both ran for one keydown
    expect([root.get(closed), child.get(closed)]).toEqual([false, true])
    stopRoot()
    stopChild()
    // Shared domain: every binding on the root Store; a command targets the child explicitly.
    log.length = 0
    const reopen = atom(0)
    bindHotkey(
        root,
        "Escape",
        tx => (log.push("root:selection"), tx.set(reopen, 1)),
    )
    bindHotkey(
        root,
        "Escape",
        tx => (log.push("root:editor"), tx.scope(child).set(closed, false)),
        { priority: 1 },
    )
    kb.down("Escape", "Escape")
    expect(log).toEqual(["root:editor"]) // one decision, priority applies across "editor" and "page" hotkeys
    expect([root.get(closed), child.get(closed), root.get(reopen)]).toEqual([
        false,
        false,
        0,
    ])
    // A disposed child target fails that command only: rolled back and reported.
    child.dispose()
    kb.down("Escape", "Escape")
    expect(
        String((kb.reported()[0] as { causes?: unknown[] }).causes?.[0]),
    ).toContain("Disposed")
    root.dispose()
})

describe("documented limitations: registering while a keydown is being delivered", () => {
    test("from another Store's subscriber, a Store with no bindings yet cannot be registered", () => {
        const a = store()
        const b = store()
        let error: unknown
        a.sub(lastKeyDownAtom, () => {
            try {
                bindHotkey(b, "j", () => {})
            } catch (caught) {
                error = caught
            }
        })
        kb.down("KeyK", "k")
        expect((error as Error | undefined)?.name).toBe("DormantExternalReadError")
        a.dispose()
        b.dispose()
    })

    test("a keydown dispatched from a subscriber before a registration, but applied after it, reaches the new binding", () => {
        const app = store()
        const runs: string[] = []
        bindHotkey(app, "m", () => {}) // the store already has a dispatcher
        app.sub(lastKeyDownAtom, () => {
            if (app.get(lastKeyDownAtom)?.code !== "KeyM") return
            kb.down("KeyN", "n") // queued: applied after this delivery
            bindHotkey(app, "n", () => void runs.push("n"))
        })
        kb.down("KeyM", "m")
        expect(runs).toEqual(["n"])
        app.dispose()
    })
})
