import { afterEach, beforeEach, expect, test } from "bun:test"
import { atom, collection, store, type Transaction } from "valdres"
import { bindHotkey } from "../src/index"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "../../browser-keyboard/test/setup/keyboardHarness"
let kb: KeyboardHarness
beforeEach(() => {
    kb = installKeyboardHarness()
})
afterEach(() => kb.restore())
const tick = () => new Promise(r => setTimeout(r, 5))
const press = (key = "Enter", code = "Enter") => {
    kb.down("ControlLeft", "Control")
    kb.down(code, key)
    kb.up(code, key)
    kb.up("ControlLeft", "Control")
}
test("public hotkeys: caller-owned settle cursor, aborted command, latest committed navigation, disposed editor", async () => {
    const root = store(),
        editor = root.scope("editor"),
        records = collection<string, { title: string }>(),
        request = atom<{ id: string } | null>(null)
    const navigated: string[] = []
    let handled: object | null = null,
        seq = 0,
        abort = false,
        dispatching = false
    // The request atom is the application policy; the hook supplies delivery.
    // Reading the latest committed request is safe even across a scheduler yield.
    const createAndOpen = (tx: Transaction) => {
        const id = String(++seq)
        tx.set(records(id), { title: id })
        tx.scope(root).set(request, { id })
        tx.onCommit(() => {
            expect(dispatching).toBe(false)
            const latest = root.get(request)
            if (latest === handled || latest === null) return
            handled = latest
            navigated.push(latest.id)
            root.txn(t => t.set(atom(0), 1))
        })
        if (abort) throw new Error("abort command")
    }
    bindHotkey(editor, "Ctrl+Enter", tx => createAndOpen(tx))
    dispatching = true
    press()
    dispatching = false
    await tick()
    expect(navigated).toEqual(["1"])
    abort = true
    press()
    abort = false
    await tick()
    expect(editor.get(records("2"))).toBeUndefined()
    expect(navigated).toEqual(["1"])
    press()
    press()
    await tick()
    expect(navigated).toEqual(["1", "4"])
    press()
    editor.dispose()
    await tick()
    expect(navigated).toEqual(["1", "4"])
    root.dispose()
})
test("public hotkeys: root-owned copies preserve starts, survive editor disposal, serial recipe preserves completion", async () => {
    const root = store(),
        editor = root.scope(),
        selection = atom(""),
        log: string[] = []
    let tail = Promise.resolve(),
        dispatching = false
    bindHotkey(editor, "Ctrl+c", tx => {
        const text = tx.get(selection)
        tx.scope(root).onCommit(() => {
            expect(dispatching).toBe(false)
            const work = tail.then(async () => {
                log.push("copy " + text)
                await Promise.resolve()
                log.push("toast " + text)
            })
            tail = work.catch(() => {})
            return work
        })
    })
    for (const text of ["a", "b"]) {
        editor.set(selection, text)
        dispatching = true
        press("c", "KeyC")
        dispatching = false
    }
    editor.dispose()
    await tick()
    expect(log).toEqual(["copy a", "toast a", "copy b", "toast b"])
    root.dispose()
})
