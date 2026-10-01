/**
 * A fresh process with no DOM: importing both entries, binding on a server
 * store and activating a scope must touch no browser global and never run a
 * command.
 */
import { strict as assert } from "node:assert"
import { atom, store } from "valdres"

assert.equal(typeof globalThis.document, "undefined")
const hotkeys = await import("../../src/index")
const internals = await import("../../src/adapter-internals")
const app = store()
const ran = atom(0)
const stop = hotkeys.bindHotkey(app, ["Mod+s", "Ctrl+KeyS"], tx =>
    tx.set(ran, 1),
)
const release = hotkeys.activateHotkeyScope(app, hotkeys.hotkeyScope())
assert.equal(app.get(hotkeys.shortcutSelector("Mod+s")), null)
const handle = internals.registerBinding(
    app,
    internals.parseShortcuts("x"),
    () => ({
        command: () => {},
    }),
)
handle.dispose()
release()
stop()
assert.equal(app.get(ran), 0)
app.dispose()
console.log("DOMLESS_OK")
