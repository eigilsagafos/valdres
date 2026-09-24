import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { selector, store, type Store } from "valdres"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "../../test/setup/keyboardHarness"
import { activateKeyboardHub, peekKeyboardHub } from "../lib/keyboardHubs"
import { lastKeyDownSource } from "../lib/lastKeyDownSource"
import { lastKeyDownSelector } from "../selectors/lastKeyDownSelector"
import { modifierSelector } from "../selectors/modifierSelector"
import { pressedCodesSelector } from "../selectors/pressedCodesSelector"
import type { KeyDown } from "../types/KeyDown"
import { keyboardAtom } from "./keyboardAtom"
import { lastKeyDownAtom } from "./lastKeyDownAtom"

let kb: KeyboardHarness
beforeEach(() => {
    kb = installKeyboardHarness()
})
afterEach(() => {
    kb.restore()
})

/** Subscriber-observed `code:repeat:sequence` strings, recorded before any
 *  diagnostic read. */
const recordKeyDowns = (app: Store) => {
    const seen: string[] = []
    const stop = app.sub(lastKeyDownAtom, () => {
        const keyDown = app.get(lastKeyDownAtom)
        seen.push(
            keyDown === null
                ? "null"
                : `${keyDown.code}:${keyDown.repeat}:${keyDown.sequence}`,
        )
    })
    return { seen, stop }
}

describe("lastKeyDownAtom", () => {
    test("is null and inert before activation", () => {
        const app = store()
        expect(app.get(lastKeyDownAtom)).toBe(null)
        kb.down("KeyA", "a")
        expect(app.get(lastKeyDownAtom)).toBe(null)
        expect(peekKeyboardHub()).toBeUndefined()
        expect(kb.physical()).toBe(0)
        app.dispose()
    })

    test("subscribing activates the shared hub without adding native listeners", () => {
        const app = store()
        const keyboard = app.sub(keyboardAtom, () => {})
        expect(kb.physical()).toBe(4)
        const keyDowns = app.sub(lastKeyDownAtom, () => {})
        expect(kb.physical()).toBe(4)
        expect(kb.invalidators()).toBe(1)
        expect(kb.keyDownInvalidators()).toBe(1)
        keyboard()
        keyDowns()
        app.dispose()
    })

    test("a subscription alone starts the hub", () => {
        const app = store()
        const { seen, stop } = recordKeyDowns(app)
        expect(kb.physical()).toBe(4)
        kb.down("KeyA", "a")
        expect(seen).toEqual(["KeyA:false:1"])
        stop()
        app.dispose()
    })

    test("notifies on every keydown, repeats included; keyups do not", () => {
        const app = store()
        const { seen, stop } = recordKeyDowns(app)
        kb.down("ArrowDown", "ArrowDown")
        kb.down("ArrowDown", "ArrowDown", { repeat: true })
        kb.down("ArrowDown", "ArrowDown", { repeat: true })
        kb.up("ArrowDown", "ArrowDown")
        expect(seen).toEqual([
            "ArrowDown:false:1",
            "ArrowDown:true:2",
            "ArrowDown:true:3",
        ])
        stop()
        app.dispose()
    })

    test("repeats never invalidate stores that only read key state", () => {
        const keyState = store()
        const keyDowns = store()
        let keyStateNotifications = 0
        let evaluations = 0
        const counted = selector(get => {
            evaluations++
            return get(pressedCodesSelector).length
        })
        keyState.sub(counted, () => keyStateNotifications++)
        const { seen } = recordKeyDowns(keyDowns)

        kb.down("KeyA", "a")
        const afterFirst = evaluations
        for (let i = 0; i < 5; i++) kb.down("KeyA", "a", { repeat: true })

        expect(seen).toHaveLength(6)
        expect(keyStateNotifications).toBe(1)
        expect(evaluations).toBe(afterFirst)
        keyState.dispose()
        keyDowns.dispose()
    })

    test("lastKeyDown is delivered before key state for the same event", () => {
        const app = store()
        const seen: string[] = []
        app.sub(pressedCodesSelector, () => {})
        app.sub(lastKeyDownAtom, () =>
            seen.push(app.get(pressedCodesSelector).join("+") || "none"),
        )
        kb.down("ShiftLeft", "Shift")
        kb.down("KeyA", "A")
        // Each keydown is observed with the keys held just before it.
        expect(seen).toEqual(["none", "ShiftLeft"])
        expect(app.get(pressedCodesSelector)).toEqual(["ShiftLeft", "KeyA"])
        app.dispose()
    })

    test("a selector over both atoms never pairs new key state with a stale keydown", () => {
        const app = store()
        const shiftArrow = selector(get =>
            get(modifierSelector("shift"))
                ? (get(lastKeyDownSelector("ArrowDown"))?.sequence ?? null)
                : null,
        )
        const seen: (number | null)[] = []
        app.sub(shiftArrow, () => seen.push(app.get(shiftArrow)))

        // ArrowDown before Shift must not count as Shift+ArrowDown.
        kb.down("ArrowDown", "ArrowDown")
        kb.up("ArrowDown", "ArrowDown")
        kb.down("ShiftLeft", "Shift")
        expect(seen).toEqual([])

        // Shift then ArrowDown, with a repeat, does.
        kb.down("ArrowDown", "ArrowDown")
        kb.down("ArrowDown", "ArrowDown", { repeat: true })
        expect(seen).toEqual([3, 4])
        app.dispose()
    })

    test("after a reset no subscriber sees the old keydown with the empty key state", () => {
        const app = store()
        const held = selector(get => {
            const keyDown = get(lastKeyDownAtom)
            return keyDown === null
                ? "none"
                : `${keyDown.code}/${get(pressedCodesSelector).join("+")}`
        })
        const seen: string[] = []
        app.sub(held, () => seen.push(app.get(held)))
        kb.down("KeyA", "a")
        kb.blur()
        expect(seen).toEqual(["KeyA/", "KeyA/KeyA", "none"])
        app.dispose()
    })

    test("IME composition keydowns are not reported", () => {
        const app = store()
        const { seen, stop } = recordKeyDowns(app)
        kb.down("KeyA", "Process", { keyCode: 229 })
        kb.down("KeyB", "b", { isComposing: true })
        expect(seen).toEqual([])
        stop()
        app.dispose()
    })

    test("focus loss resets to null; the sequence keeps counting", () => {
        const app = store()
        const { seen, stop } = recordKeyDowns(app)
        kb.down("KeyA", "a")
        kb.blur()
        kb.blur()
        kb.down("KeyB", "b")
        kb.setVisibility("hidden")
        expect(seen).toEqual(["KeyA:false:1", "null", "KeyB:false:2", "null"])
        stop()
        app.dispose()
    })

    test("with zero subscribers keydowns are still tracked for a later read", () => {
        activateKeyboardHub()
        const app = store()
        kb.down("KeyA", "a")
        kb.down("KeyA", "a", { repeat: true })
        const keyDown = app.get(lastKeyDownAtom) as KeyDown
        expect(keyDown).toEqual({
            code: "KeyA",
            key: "a",
            repeat: true,
            timeStamp: keyDown.timeStamp,
            sequence: 2,
        })
        expect(kb.keyDownInvalidators()).toBe(0)
        app.dispose()
    })

    test("two stores each get every keydown; unsubscribing one keeps the hub", () => {
        const first = store()
        const second = store()
        const a = recordKeyDowns(first)
        const b = recordKeyDowns(second)
        kb.down("KeyA", "a")
        a.stop()
        kb.down("KeyA", "a", { repeat: true })
        expect(a.seen).toEqual(["KeyA:false:1"])
        expect(b.seen).toEqual(["KeyA:false:1", "KeyA:true:2"])
        expect(kb.keyDownInvalidators()).toBe(1)
        b.stop()
        expect(kb.keyDownInvalidators()).toBe(0)
        expect(kb.physical()).toBe(4)
        first.dispose()
        second.dispose()
    })

    test("a throwing key-state subscriber cannot starve lastKeyDown delivery", () => {
        const failing = store()
        const healthy = store()
        failing.sub(keyboardAtom, () => {
            throw new Error("key state subscriber exploded")
        })
        const { seen } = recordKeyDowns(healthy)

        kb.down("KeyA", "a")
        expect(seen).toEqual(["KeyA:false:1"])
        expect((kb.reported()[0] as Error).name).toBe(
            "SubscriberNotificationError",
        )

        kb.down("KeyA", "a", { repeat: true })
        expect(seen).toEqual(["KeyA:false:1", "KeyA:true:2"])
        failing.dispose()
        healthy.dispose()
    })

    test("a keydown dispatched from a subscriber is applied after the current event", () => {
        const app = store()
        const keyDowns: string[] = []
        let nested = false
        app.sub(keyboardAtom, () => {
            if (!nested) {
                nested = true
                kb.down("KeyB", "b")
            }
        })
        app.sub(lastKeyDownAtom, () => {
            const keyDown = app.get(lastKeyDownAtom)!
            keyDowns.push(`${keyDown.code}:${keyDown.sequence}`)
        })

        kb.down("KeyA", "a")

        expect(keyDowns).toEqual(["KeyA:1", "KeyB:2"])
        expect(app.get(pressedCodesSelector)).toEqual(["KeyA", "KeyB"])
        expect(app.get(lastKeyDownAtom)?.code).toBe("KeyB")
        expect(kb.reported()).toEqual([])
        app.dispose()
    })

    test("a blur dispatched from a subscriber leaves both channels reset", () => {
        const app = store()
        let blurred = false
        app.sub(keyboardAtom, () => {
            if (!blurred) {
                blurred = true
                kb.blur()
            }
        })
        app.sub(lastKeyDownAtom, () => {})

        kb.down("KeyA", "a")

        expect(app.get(pressedCodesSelector)).toEqual([])
        expect(app.get(lastKeyDownAtom)).toBe(null)
        app.dispose()
    })

    test("failures from both channels are reported together", () => {
        const keyState = store()
        const keyDowns = store()
        keyState.sub(keyboardAtom, () => {
            throw new Error("key state")
        })
        keyDowns.sub(lastKeyDownAtom, () => {
            throw new Error("key down")
        })

        kb.down("KeyA", "a")

        const [reported] = kb.reported()
        expect(reported).toBeInstanceOf(AggregateError)
        expect((reported as AggregateError).errors).toHaveLength(2)
        expect(keyState.get(keyboardAtom).pressed).toHaveLength(1)
        expect(keyDowns.get(lastKeyDownAtom)?.code).toBe("KeyA")
        keyState.dispose()
        keyDowns.dispose()
    })

    test("a subscriber that keeps dispatching keydowns is stopped, not hung", () => {
        const app = store()
        let fired = 0
        app.sub(lastKeyDownAtom, () => {
            fired++
            kb.down("KeyA", "a", { repeat: true })
        })

        kb.down("KeyA", "a")

        expect(fired).toBe(64)
        const [reported] = kb.reported()
        expect(reported).toBeInstanceOf(RangeError)
        // The hub still works on the next native event.
        fired = 0
        app.dispose()
        const next = store()
        const seen: number[] = []
        next.sub(lastKeyDownAtom, () =>
            seen.push(next.get(lastKeyDownAtom)!.sequence),
        )
        kb.down("KeyB", "b")
        // 64 keydowns were applied (1–64); dropped ones take no number.
        expect(seen).toEqual([65])
        next.dispose()
    })

    test("a malformed event publishes nothing and does not drop queued events", () => {
        const app = store()
        app.sub(lastKeyDownAtom, () => {})
        app.sub(keyboardAtom, () => {})
        kb.down("KeyA", "a")
        const malformed = new Event("keydown")
        Object.defineProperty(malformed, "code", { value: "CapsLock" })
        document.dispatchEvent(malformed)

        expect(app.get(lastKeyDownAtom)?.code).toBe("KeyA")
        expect(kb.reported()).toHaveLength(1)
        app.dispose()
    })

    test("the server snapshot is null", () => {
        expect(lastKeyDownSource.getServerSnapshot?.()).toBe(null)
    })

    test("is read-only", () => {
        const app = store()
        const loose = app as unknown as Record<
            string,
            (...args: unknown[]) => void
        >
        expect(() => loose.set!(lastKeyDownAtom, null)).toThrow(TypeError)
        expect(() => loose.reset!(lastKeyDownAtom)).toThrow(TypeError)
        app.dispose()
    })
})
