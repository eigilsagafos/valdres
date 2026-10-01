/**
 * Keyboard commands through the public core `store.sub(state, { settle, notify })`
 * API. The keyboard publishes held keys and the latest keydown as one source
 * snapshot, so a settle handler triggered by a keydown sees the held state after
 * that keydown, and ordinary subscribers see the command's result in the same,
 * single notification.
 *
 * A retained `lastKeyDown` value is not an exactly-once event queue: a trigger
 * that becomes eligible again later re-serves the same occurrence. Consumers
 * that must run a command once per keydown gate on `sequence`, as the fixture
 * below does, starting from `latestKeyDownSequence()` so that a keydown from
 * before registration never counts.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { atom, selector, store, type Selector, type Store } from "valdres"
import {
    activateKeyboard,
    isCodePressedSelector,
    lastKeyDownAtom,
    latestKeyDownSequence,
    lastKeyDownSelector,
    modifierSelector,
    pressedCodesSelector,
    type KeyDown,
} from "../src/index"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "./setup/keyboardHarness"

let kb: KeyboardHarness
beforeEach(() => {
    kb = installKeyboardHarness()
})
afterEach(() => {
    kb.restore()
})

/** "Shift is held and the latest keydown was ArrowDown": the occurrence, or null. */
const shiftArrowDown = selector<KeyDown | null>(get => {
    const keyDown = get(lastKeyDownSelector("ArrowDown"))
    return keyDown !== null && get(modifierSelector("shift")) ? keyDown : null
})

/**
 * Consumer fixture: runs `command` at most once per keydown occurrence of the
 * trigger, recording the handled `sequence` in the same transaction.
 */
const gatedCommand = (app: Store, trigger: Selector<KeyDown | null>) => {
    const handled = atom(0)
    // The watermark is read at registration, as the docs show.
    app.set(handled, latestKeyDownSequence())
    const runs = atom(0)
    const settleCalls = { count: 0 }
    const stop = app.sub(trigger, {
        settle: tx => {
            settleCalls.count++
            const keyDown = tx.get(trigger)
            if (keyDown === null || keyDown.sequence <= tx.get(handled)) return
            tx.set(handled, keyDown.sequence)
            tx.set(runs, tx.get(runs) + 1)
        },
    })
    return { runs, handled, settleCalls, stop }
}

describe("keyboard commands in settle handlers", () => {
    test("first A keydown: settle sees A held; notify sees one coherent final state", () => {
        const app = store()
        const result = atom<string | null>(null)
        const settled: boolean[] = []
        app.sub(lastKeyDownSelector("KeyA"), {
            settle: tx => {
                const keyDown = tx.get(lastKeyDownSelector("KeyA"))
                if (keyDown === null) return
                const held = tx.get(isCodePressedSelector("KeyA"))
                settled.push(held)
                tx.set(result, held ? `ran:${keyDown.sequence}` : "not-held")
            },
        })
        const view = selector(
            get =>
                `${get(pressedCodesSelector).join("+")}|${get(lastKeyDownAtom)?.code}|${get(result)}`,
        )
        const seen: string[] = []
        const notified: string[] = []
        app.sub(view, () => seen.push(app.get(view)))
        app.sub(result, { notify: () => notified.push(app.get(view)) })

        kb.down("KeyA", "a")

        // One settlement: the command saw A held, and ordinary subscribers saw
        // the key state and the command's result together, exactly once.
        expect(settled).toEqual([true])
        expect(seen).toEqual(["KeyA|KeyA|ran:1"])
        expect(notified).toEqual(["KeyA|KeyA|ran:1"])
        app.dispose()
    })

    test("a trigger combining occurrence and held state runs one command per keydown", () => {
        const app = store()
        const shiftS = selector<KeyDown | null>(get => {
            const keyDown = get(lastKeyDownSelector("KeyS"))
            return keyDown !== null && get(modifierSelector("shift"))
                ? keyDown
                : null
        })
        const { runs, settleCalls } = gatedCommand(app, shiftS)
        // An ungated handler whose trigger depends on both the occurrence and
        // the held keys: it runs once per change of that combined value.
        const combined = selector(get => {
            const keyDown = get(lastKeyDownAtom)
            return keyDown === null
                ? null
                : `${keyDown.code}#${keyDown.sequence}/${get(pressedCodesSelector).join("+")}`
        })
        const combinedRuns: (string | null)[] = []
        app.sub(combined, {
            settle: tx => void combinedRuns.push(tx.get(combined)),
        })

        kb.down("ShiftLeft", "Shift")
        kb.down("KeyS", "S")

        expect(app.get(runs)).toBe(1)
        // Occurrence and held state change in the same settlement, so each
        // trigger changes once per keydown and never passes through a mix.
        expect(settleCalls.count).toBe(1)
        expect(combinedRuns).toEqual([
            "ShiftLeft#1/ShiftLeft",
            "KeyS#2/ShiftLeft+KeyS",
        ])
        app.dispose()
    })

    test("each repeat is one new occurrence; held-only subscribers are not notified", () => {
        const app = store()
        const { runs, settleCalls } = gatedCommand(
            app,
            lastKeyDownSelector("ArrowDown"),
        )
        const held: (readonly string[])[] = []
        app.sub(pressedCodesSelector, () =>
            held.push(app.get(pressedCodesSelector)),
        )

        kb.down("ArrowDown", "ArrowDown")
        kb.down("ArrowDown", "ArrowDown", { repeat: true })
        kb.down("ArrowDown", "ArrowDown", { repeat: true })

        expect(app.get(runs)).toBe(3)
        expect(settleCalls.count).toBe(3)
        expect(held).toEqual([["ArrowDown"]])
        app.dispose()
    })

    test("Shift→ArrowDown runs; ArrowDown→Shift does not reuse the earlier ArrowDown", () => {
        const app = store()
        const { runs, handled } = gatedCommand(app, shiftArrowDown)

        // ArrowDown first, then Shift: the latest keydown is Shift.
        kb.down("ArrowDown", "ArrowDown")
        kb.up("ArrowDown", "ArrowDown")
        kb.down("ShiftLeft", "Shift")
        expect(app.get(runs)).toBe(0)

        // Shift held, then ArrowDown: that ArrowDown occurrence runs once.
        kb.down("ArrowDown", "ArrowDown")
        expect(app.get(runs)).toBe(1)
        expect(app.get(handled)).toBe(3)
        app.dispose()
    })

    test("keyup, reset, eligibility changes and late registration do not replay a gated command", () => {
        const app = store()
        const enabled = atom(true)
        const trigger = selector<KeyDown | null>(get =>
            get(enabled) ? get(lastKeyDownSelector("KeyK")) : null,
        )
        const gated = gatedCommand(app, trigger)

        // Control: an ungated handler on the same trigger re-runs whenever the
        // retained occurrence becomes eligible again.
        let ungated = 0
        app.sub(trigger, {
            settle: tx => {
                if (tx.get(trigger) !== null) ungated++
            },
        })

        kb.down("KeyK", "k")
        expect(app.get(gated.runs)).toBe(1)

        kb.up("KeyK", "k")
        app.set(enabled, false)
        app.set(enabled, true)
        expect(app.get(gated.runs)).toBe(1)
        expect(ungated).toBe(2)

        // A handler registered after the keydown never runs for it.
        const late = gatedCommand(app, trigger)
        expect(app.get(late.runs)).toBe(0)
        expect(late.settleCalls.count).toBe(0)

        kb.blur()
        app.set(enabled, false)
        app.set(enabled, true)
        expect(app.get(gated.runs)).toBe(1)

        // A new keydown is a new occurrence for both handlers.
        kb.down("KeyK", "k")
        expect(app.get(gated.runs)).toBe(2)
        expect(app.get(late.runs)).toBe(1)
        app.dispose()
    })

    test("a throwing settle handler does not stop healthy handlers, stores or later events", () => {
        const failing = store()
        const healthy = store()
        const failingRuns = atom(0)
        failing.sub(lastKeyDownSelector("KeyA"), {
            settle: () => {
                throw new Error("settle exploded")
            },
        })
        const sameStore = gatedCommand(failing, lastKeyDownSelector("KeyA"))
        failing.sub(failingRuns, () => {})
        const otherStore = gatedCommand(healthy, lastKeyDownSelector("KeyA"))

        kb.down("KeyA", "a")

        expect(failing.get(sameStore.runs)).toBe(1)
        expect(healthy.get(otherStore.runs)).toBe(1)
        const [reported] = kb.reported()
        expect((reported as Error).name).toBe("SubscriberNotificationError")
        expect(
            String((reported as { causes?: unknown[] }).causes?.[0]),
        ).toContain("settle exploded")

        kb.down("KeyA", "a", { repeat: true })
        expect(failing.get(sameStore.runs)).toBe(2)
        expect(healthy.get(otherStore.runs)).toBe(2)
        failing.dispose()
        healthy.dispose()
    })

    test("the watermark: a late handler never acts on a keydown from before it, even when eligibility returns", () => {
        activateKeyboard()
        const app = store()
        const enabled = atom(true)
        const trigger = selector<KeyDown | null>(get =>
            get(enabled) ? get(lastKeyDownSelector("KeyK")) : null,
        )
        kb.down("KeyK", "k") // before either handler exists
        const fromZero = { runs: 0 }
        const fromZeroHandled = atom(0)
        app.sub(trigger, {
            settle: tx => {
                const keyDown = tx.get(trigger)
                if (
                    keyDown === null ||
                    keyDown.sequence <= tx.get(fromZeroHandled)
                )
                    return
                tx.set(fromZeroHandled, keyDown.sequence)
                fromZero.runs++
            },
        })
        const watermarked = gatedCommand(app, trigger)
        app.set(enabled, false)
        app.set(enabled, true)
        // Starting from 0 re-serves the earlier keydown; the watermark does not.
        expect([fromZero.runs, app.get(watermarked.runs)]).toEqual([1, 0])
        // A gated trigger still re-serves a keydown pressed while it was
        // ineligible: only an occurrence-keyed trigger avoids that.
        app.set(enabled, false)
        kb.up("KeyK", "k")
        kb.down("KeyK", "k")
        app.set(enabled, true)
        expect(app.get(watermarked.runs)).toBe(1)
        app.dispose()
    })

    test("a watermark read at module load protects nothing; one read at registration does", () => {
        // Simulates `const handled = atom(latestKeyDownSequence())` at module load:
        // nothing observed yet, so the default is 0.
        const moduleLoadDefault = latestKeyDownSequence()
        expect(moduleLoadDefault).toBe(0)
        activateKeyboard()
        const app = store()
        const enabled = atom(true)
        const trigger = selector<KeyDown | null>(get =>
            get(enabled) ? get(lastKeyDownSelector("KeyK")) : null,
        )
        kb.down("KeyK", "k") // before registration
        const stale = atom(moduleLoadDefault)
        let staleRuns = 0
        app.sub(trigger, {
            settle: tx => {
                const keyDown = tx.get(trigger)
                if (keyDown === null || keyDown.sequence <= tx.get(stale))
                    return
                tx.set(stale, keyDown.sequence)
                staleRuns++
            },
        })
        const atRegistration = gatedCommand(app, trigger)
        app.set(enabled, false)
        app.set(enabled, true)
        expect([staleRuns, app.get(atRegistration.runs)]).toEqual([1, 0])
        app.dispose()
    })
})
