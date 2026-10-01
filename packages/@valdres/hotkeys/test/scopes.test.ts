import { afterEach, beforeEach, expect, test } from "bun:test"
import { store } from "valdres"
import { activateHotkeyScope, bindHotkey, hotkeyScope } from "../src/index"
import { inspectRegistry } from "../src/lib/registry"
import { scopeCountAtom } from "../src/lib/scopeState"
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

test("a scope is frozen data with a per-store active selector; its count is not reachable", () => {
    const modal = hotkeyScope({ name: "modal", priority: 3, exclusive: true })
    expect(Object.isFrozen(modal)).toBe(true)
    expect(Object.keys(modal).sort()).toEqual(["exclusive", "name", "priority"])
    const one = store()
    const two = store()
    const release = activateHotkeyScope(one, modal)
    expect([
        one.get(scopeCountAtom(modal, one)),
        two.get(scopeCountAtom(modal, two)),
    ]).toEqual([1, 0])
    expect(inspectRegistry(one).exclusiveScopes).toBe(1)
    release()
    release() // idempotent
    expect([
        one.get(scopeCountAtom(modal, one)),
        inspectRegistry(one).exclusiveScopes,
    ]).toEqual([0, 0])
    one.dispose()
    two.dispose()
})

test("invalid scopes and activation in a transaction are rejected", () => {
    expect(() => hotkeyScope({ priority: Number.NaN })).toThrow(TypeError)
    expect(() =>
        bindHotkey(store(), "k", () => {}, { priority: Infinity }),
    ).toThrow(TypeError)
    expect(() => bindHotkey(store(), "k", 1 as never)).toThrow(TypeError)
    const app = store()
    expect(() =>
        activateHotkeyScope(app, {
            name: "fake",
            priority: 0,
            exclusive: false,
        }),
    ).toThrow(TypeError)
    const modal = hotkeyScope()
    bindHotkey(app, "a", () => void activateHotkeyScope(app, modal))
    kb.down("KeyA", "a")
    expect(
        String((kb.reported()[0] as { causes?: unknown[] }).causes?.[0]),
    ).toContain("TransactionPhaseError")
    expect(app.get(scopeCountAtom(modal, app))).toBe(0)
    app.dispose()
})

test("release after the store is disposed is a no-op", () => {
    const app = store()
    const release = activateHotkeyScope(app, hotkeyScope())
    app.dispose()
    expect(release).not.toThrow()
})
