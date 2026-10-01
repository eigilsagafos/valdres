/**
 * Regressions for the #414 implementation review: exception-safe, strictly
 * per-Store scope activation (B1, B2) and contained promise-returning commands.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { atom, store, type Store } from "valdres"
import { activateHotkeyScope, bindHotkey, hotkeyScope } from "../src/index"
import { scopeCountAtom } from "../src/lib/scopeState"
import {
    causes,
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

/** The base binding "k" runs iff no exclusive scope blocks the base layer in `app`. */
const baseBlocked = (app: Store, probe: ReturnType<typeof counted>) => {
    const before = probe.count()
    kb.down("KeyK", "k")
    kb.up("KeyK", "k")
    return probe.count() === before
}

describe("B1: exception-safe release", () => {
    test("a release rejected inside a command changes nothing and stays retryable", () => {
        const app = store()
        const dialog = hotkeyScope({
            name: "dialog",
            priority: 10,
            exclusive: true,
        })
        const k = counted(app, "k")
        const open = atom(true)
        const release = activateHotkeyScope(app, dialog)
        bindHotkey(
            app,
            "Escape",
            tx => {
                tx.set(open, false)
                release() // store work inside the keydown's transaction: rejected
            },
            { scope: dialog },
        )
        kb.down("Escape", "Escape")
        expect(causes(kb.reported()[0])).toContain("TransactionPhaseError")
        expect(app.get(open)).toBe(true) // the command rolled back
        expect(baseBlocked(app, k)).toBe(true) // still active and still exclusive
        release() // retry outside the transaction
        expect(baseBlocked(app, k)).toBe(false)
        release() // idempotent
        expect(baseBlocked(app, k)).toBe(false)
        app.dispose()
    })

    test("a release rejected inside a subscriber changes nothing and stays retryable", () => {
        const app = store()
        const dialog = hotkeyScope({ priority: 10, exclusive: true })
        const k = counted(app, "k")
        const trigger = atom(0)
        const release = activateHotkeyScope(app, dialog)
        const errors: unknown[] = []
        const stop = app.sub(trigger, () => {
            try {
                release()
            } catch (error) {
                errors.push(error)
            }
        })
        app.set(trigger, 1)
        expect(errors).toHaveLength(1)
        expect(baseBlocked(app, k)).toBe(true)
        stop()
        release()
        expect(baseBlocked(app, k)).toBe(false)
        app.dispose()
    })

    test("a release whose write commits but whose notification throws is complete: no double decrement", () => {
        const app = store()
        const dialog = hotkeyScope({ priority: 10, exclusive: true })
        const k = counted(app, "k")
        const first = activateHotkeyScope(app, dialog)
        const second = activateHotkeyScope(app, dialog)
        const count = scopeCountAtom(dialog, app)
        let fail = true
        const stop = app.sub(count, () => {
            if (fail) throw new Error("subscriber exploded")
        })
        expect(() => first()).toThrow() // committed, then notification threw
        expect(app.get(count)).toBe(1)
        fail = false
        first() // already released: must not decrement again
        first()
        expect(app.get(count)).toBe(1)
        expect(baseBlocked(app, k)).toBe(true) // the second holder keeps it exclusive
        second()
        expect(app.get(count)).toBe(0)
        expect(baseBlocked(app, k)).toBe(false)
        stop()
        app.dispose()
    })

    test("an activation whose write commits but whose notification throws restores the final count", () => {
        const app = store()
        const dialog = hotkeyScope({ priority: 10, exclusive: true })
        const k = counted(app, "k")
        const count = scopeCountAtom(dialog, app)
        const stop = app.sub(count, () => {
            throw new Error("subscriber exploded")
        })
        expect(() => activateHotkeyScope(app, dialog)).toThrow()
        stop()
        expect(app.get(count)).toBe(0)
        expect(baseBlocked(app, k)).toBe(false)
        app.dispose()
    })

    test("activation and release after disposal", () => {
        const app = store()
        const release = activateHotkeyScope(app, hotkeyScope())
        app.dispose()
        expect(() => release()).not.toThrow()
        expect(() => activateHotkeyScope(app, hotkeyScope())).toThrow()
    })
})

describe("B2: activation is strictly per Store object", () => {
    const setup = () => {
        const root = store()
        const child = root.scope("panel")
        const dialog = hotkeyScope({
            name: "dialog",
            priority: 10,
            exclusive: true,
        })
        const rootK = counted(root, "k")
        const childK = counted(child, "k")
        const rootDialog = counted(root, "Escape", { scope: dialog })
        const childDialog = counted(child, "Escape", { scope: dialog })
        const escape = () => {
            kb.down("Escape", "Escape")
            kb.up("Escape", "Escape")
            return [root.get(rootDialog.runs), child.get(childDialog.runs)]
        }
        return { root, child, dialog, rootK, childK, escape }
    }

    test("activating in the root does not activate, or make exclusive, the child", () => {
        const { root, child, dialog, rootK, childK, escape } = setup()
        const release = activateHotkeyScope(root, dialog)
        expect(escape()).toEqual([1, 0])
        expect([baseBlocked(root, rootK), baseBlocked(child, childK)]).toEqual([
            true,
            false,
        ])
        release()
        root.dispose()
    })

    test("root and child activations are independent, released in either order", () => {
        for (const order of ["root-first", "child-first"] as const) {
            const { root, child, dialog, rootK, childK, escape } = setup()
            const releaseRoot = activateHotkeyScope(root, dialog)
            const releaseChild = activateHotkeyScope(child, dialog)
            expect(escape()).toEqual([1, 1])
            const [firstRelease, secondRelease] =
                order === "root-first"
                    ? [releaseRoot, releaseChild]
                    : [releaseChild, releaseRoot]
            firstRelease()
            expect([
                baseBlocked(root, rootK),
                baseBlocked(child, childK),
            ]).toEqual(order === "root-first" ? [false, true] : [true, false])
            secondRelease()
            expect([
                baseBlocked(root, rootK),
                baseBlocked(child, childK),
            ]).toEqual([false, false])
            expect(escape()).toEqual([1, 1])
            root.dispose()
        }
    })

    test("several holders per Store; disposing the child leaves the root active", () => {
        const { root, child, dialog, rootK } = setup()
        const a = activateHotkeyScope(root, dialog)
        const b = activateHotkeyScope(root, dialog)
        const c = activateHotkeyScope(child, dialog)
        a()
        expect(baseBlocked(root, rootK)).toBe(true)
        child.dispose()
        expect(() => c()).not.toThrow()
        expect(baseBlocked(root, rootK)).toBe(true)
        b()
        expect(baseBlocked(root, rootK)).toBe(false)
        root.dispose()
    })
})

describe("promise-returning commands", () => {
    test("are rejected and rolled back without an unhandled rejection", async () => {
        const unhandled: unknown[] = []
        const onUnhandled = (reason: unknown) => void unhandled.push(reason)
        process.on("unhandledRejection", onUnhandled)
        try {
            const app = store()
            const touched = atom(0)
            bindHotkey(
                app,
                "p",
                tx => {
                    tx.set(touched, 1)
                    return Promise.reject(
                        new Error("async failure"),
                    ) as unknown as void
                },
                { preventDefault: true },
            )
            const event = kb.down("KeyP", "p")
            await new Promise(resolve => setTimeout(resolve, 10))
            expect(app.get(touched)).toBe(0)
            expect(causes(kb.reported()[0])).toContain(
                "InvalidTransactionCallbackResultError",
            )
            expect(event.defaultPrevented).toBe(true) // cancellation precedes the command, by design
            expect(unhandled).toEqual([])
            app.dispose()
        } finally {
            process.off("unhandledRejection", onUnhandled)
        }
    })
})
