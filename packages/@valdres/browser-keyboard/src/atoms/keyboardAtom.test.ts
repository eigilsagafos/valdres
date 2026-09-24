import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { selector, store } from "valdres"
import {
    installKeyboardHarness,
    type KeyboardHarness,
} from "../../test/setup/keyboardHarness"
import { EMPTY_KEYBOARD_SNAPSHOT } from "../lib/emptyKeyboardSnapshot"
import { activateKeyboardHub, peekKeyboardHub } from "../lib/keyboardHubs"
import { keyboardSource } from "../lib/keyboardSource"
import { pressedCodesSelector } from "../selectors/pressedCodesSelector"
import { keyboardAtom } from "./keyboardAtom"

// document keydown + keyup + visibilitychange, window blur.
const HUB_LISTENERS = 4

let kb: KeyboardHarness
beforeEach(() => {
    kb = installKeyboardHarness()
})
afterEach(() => {
    kb.restore()
})

const codesOf = (app: ReturnType<typeof store>) => () =>
    app.get(keyboardAtom).pressed.map(k => k.code)

describe("activation", () => {
    test("a dormant read neither activates nor attaches anything", () => {
        const app = store()

        expect(app.get(keyboardAtom)).toBe(EMPTY_KEYBOARD_SNAPSHOT)
        expect(app.get(pressedCodesSelector)).toEqual([])
        expect(peekKeyboardHub()).toBeUndefined()
        expect(kb.physical()).toBe(0)

        // Nothing is listening, so a key event is simply not observed.
        kb.down("KeyA", "a")
        expect(app.get(keyboardAtom)).toBe(EMPTY_KEYBOARD_SNAPSHOT)
        expect(kb.physical()).toBe(0)

        app.dispose()
    })

    test("a store subscription activates one physical hub", () => {
        const app = store()
        const stop = app.sub(keyboardAtom, () => {})

        expect(kb.listeners("document", "keydown")).toBe(1)
        expect(kb.listeners("document", "keyup")).toBe(1)
        expect(kb.listeners("document", "visibilitychange")).toBe(1)
        expect(kb.listeners("window", "blur")).toBe(1)
        expect(kb.physical()).toBe(HUB_LISTENERS)
        expect(kb.invalidators()).toBe(1)

        stop()
        app.dispose()
    })

    test("a transitive selector subscription reaches the same hub", () => {
        const app = store()
        const seen: (readonly string[])[] = []
        const stop = app.sub(pressedCodesSelector, () =>
            seen.push(app.get(pressedCodesSelector)),
        )
        expect(kb.physical()).toBe(HUB_LISTENERS)

        kb.down("KeyA", "a")
        expect(seen).toEqual([["KeyA"]])

        stop()
        app.dispose()
    })

    test("activation is idempotent", () => {
        const hub = activateKeyboardHub()!
        expect(activateKeyboardHub()).toBe(hub)
        expect(kb.physical()).toBe(HUB_LISTENERS)
    })

    test("a failed attach rolls back and leaves the hub unactivated", () => {
        const failure = new Error("attach refused")
        kb.failOnAttach("document", "visibilitychange", failure)

        expect(() => activateKeyboardHub()).toThrow(failure)
        expect(kb.physical()).toBe(0)
        expect(peekKeyboardHub()).toBeUndefined()

        // The next attempt starts cleanly.
        activateKeyboardHub()
        expect(kb.physical()).toBe(HUB_LISTENERS)
    })

    test("the source's server snapshot is the one stable empty snapshot", () => {
        activateKeyboardHub()
        kb.down("KeyA", "a")
        expect(keyboardSource.getServerSnapshot?.()).toBe(
            EMPTY_KEYBOARD_SNAPSHOT,
        )
        expect(keyboardSource.getServerSnapshot?.()).toBe(
            EMPTY_KEYBOARD_SNAPSHOT,
        )
        expect(keyboardSource.getSnapshot()).not.toBe(EMPTY_KEYBOARD_SNAPSHOT)
    })
})

describe("persistent hub lifetime", () => {
    test("unsubscribing removes only the invalidator; tracking continues with zero subscribers", () => {
        const app = store()
        const stop = app.sub(keyboardAtom, () => {})
        stop()

        expect(kb.invalidators()).toBe(0)
        expect(kb.physical()).toBe(HUB_LISTENERS)

        // Zero subscribers: the hub still observes keydown and keyup.
        kb.down("KeyA", "a")
        kb.down("KeyB", "b")
        kb.up("KeyA", "a")
        expect(
            peekKeyboardHub()
                ?.keyboard.current()
                .pressed.map(k => k.code),
        ).toEqual(["KeyB"])

        // A dormant read reports what the hub observed, without re-attaching.
        expect(codesOf(app)()).toEqual(["KeyB"])
        expect(kb.physical()).toBe(HUB_LISTENERS)

        app.dispose()
    })

    test("with zero subscribers an event does no Valdres work", () => {
        const app = store()
        let evaluations = 0
        const counted = selector(get => {
            evaluations++
            return get(keyboardAtom).pressed.length
        })
        const stop = app.sub(counted, () => {})
        kb.down("KeyA", "a")
        expect(evaluations).toBe(2)
        stop()

        kb.up("KeyA", "a")
        kb.down("KeyB", "b")
        kb.blur()
        kb.down("KeyC", "c")
        expect(evaluations).toBe(2)
        expect(kb.invalidators()).toBe(0)

        // Reading later settles once against the current snapshot.
        expect(app.get(counted)).toBe(1)
        expect(evaluations).toBe(3)

        app.dispose()
    })

    test("a fresh subscription after zero-subscriber events catches up, then follows", () => {
        const app = store()
        app.sub(keyboardAtom, () => {})()

        kb.down("ShiftLeft", "Shift")
        kb.down("KeyA", "A")

        const seen: (readonly string[])[] = []
        const stop = app.sub(pressedCodesSelector, () =>
            seen.push(app.get(pressedCodesSelector)),
        )
        kb.up("KeyA", "a")
        expect(seen).toEqual([["ShiftLeft"]])
        expect(kb.physical()).toBe(HUB_LISTENERS)
        expect(kb.invalidators()).toBe(1)

        stop()
        app.dispose()
    })

    test("disposing a store with live subscribers releases its invalidator, not the hub", () => {
        const app = store()
        app.sub(keyboardAtom, () => {})
        expect(kb.invalidators()).toBe(1)

        app.dispose()
        expect(kb.invalidators()).toBe(0)
        expect(kb.physical()).toBe(HUB_LISTENERS)
    })

    test("cleanup is idempotent", () => {
        const app = store()
        const stop = app.sub(keyboardAtom, () => {})
        stop()
        expect(() => stop()).not.toThrow()
        expect(kb.invalidators()).toBe(0)
        app.dispose()
    })
})

describe("multiple stores and scopes", () => {
    test("two stores share one physical hub with independent invalidators", () => {
        const first = store()
        const second = store()
        const seen: string[] = []

        const stopFirst = first.sub(keyboardAtom, () =>
            seen.push(`first:${codesOf(first)()}`),
        )
        const stopSecond = second.sub(keyboardAtom, () =>
            seen.push(`second:${codesOf(second)()}`),
        )
        expect(kb.physical()).toBe(HUB_LISTENERS)
        expect(kb.invalidators()).toBe(2)

        kb.down("KeyA", "a")
        expect(seen).toEqual(["first:KeyA", "second:KeyA"])

        stopFirst()
        expect(kb.invalidators()).toBe(1)
        seen.length = 0
        kb.up("KeyA", "a")
        expect(seen).toEqual(["second:"])

        stopSecond()
        expect(kb.invalidators()).toBe(0)
        expect(kb.physical()).toBe(HUB_LISTENERS)

        first.dispose()
        second.dispose()
    })

    test("disposing one store leaves the other receiving events", () => {
        const first = store()
        const second = store()
        const seen: string[] = []
        first.sub(keyboardAtom, () => seen.push("first"))
        second.sub(keyboardAtom, () => seen.push(codesOf(second)().join()))

        first.dispose()
        kb.down("KeyQ", "q")
        expect(seen).toEqual(["KeyQ"])
        expect(kb.invalidators()).toBe(1)

        second.dispose()
    })

    test("a child scope shares its tree's registration", () => {
        const app = store()
        const child = app.scope()
        const seen: string[] = []

        const stopRoot = app.sub(keyboardAtom, () => {})
        const stopChild = child.sub(keyboardAtom, () =>
            seen.push(codesOf(child)().join()),
        )
        expect(kb.invalidators()).toBe(1)
        expect(kb.physical()).toBe(HUB_LISTENERS)

        kb.down("KeyA", "a")
        expect(seen).toEqual(["KeyA"])

        stopChild()
        stopRoot()
        expect(kb.invalidators()).toBe(0)
        child.dispose()
        app.dispose()
    })
})

describe("hub-owned fan-out", () => {
    test("a throwing subscriber cannot starve a healthy store; the failure is reported", () => {
        const failing = store()
        const healthy = store()
        const seen: string[] = []
        failing.sub(keyboardAtom, () => {
            throw new Error("subscriber exploded")
        })
        healthy.sub(keyboardAtom, () => seen.push(codesOf(healthy)().join()))

        kb.down("KeyA", "a")

        expect(seen).toEqual(["KeyA"])
        const reported = kb.reported()
        expect(reported).toHaveLength(1)
        expect((reported[0] as Error).name).toBe("SubscriberNotificationError")
        expect(
            String((reported[0] as { causes?: unknown[] }).causes?.[0]),
        ).toContain("subscriber exploded")

        // The next native event is still delivered to both stores.
        kb.down("KeyB", "b")
        expect(seen).toEqual(["KeyA", "KeyA,KeyB"])
        expect(kb.reported()).toHaveLength(2)
        expect(codesOf(failing)()).toEqual(["KeyA", "KeyB"])

        failing.dispose()
        healthy.dispose()
    })

    test("several failures are reported together after every store is invalidated", () => {
        const stores = [store(), store(), store()]
        const seen: number[] = []
        stores[0]!.sub(keyboardAtom, () => {
            throw new Error("first")
        })
        stores[1]!.sub(keyboardAtom, () => seen.push(1))
        stores[2]!.sub(keyboardAtom, () => {
            throw new Error("third")
        })

        kb.down("KeyA", "a")

        expect(seen).toEqual([1])
        const [reported] = kb.reported()
        expect(reported).toBeInstanceOf(AggregateError)
        expect((reported as AggregateError).errors).toHaveLength(2)

        for (const app of stores) app.dispose()
    })

    test("a subscriber that unsubscribes a later store mid-delivery skips it", () => {
        const first = store()
        const second = store()
        const seen: string[] = []
        let stopSecond = () => {}
        first.sub(keyboardAtom, () => {
            seen.push("first")
            stopSecond()
        })
        stopSecond = second.sub(keyboardAtom, () => seen.push("second"))

        kb.down("KeyA", "a")
        expect(seen).toEqual(["first"])
        expect(kb.invalidators()).toBe(1)
        // The detached store still reads current truth.
        expect(codesOf(second)()).toEqual(["KeyA"])

        first.dispose()
        second.dispose()
    })

    test("a subscriber that unsubscribes itself mid-delivery does not disturb the others", () => {
        const first = store()
        const second = store()
        const seen: string[] = []
        const stopFirst = first.sub(keyboardAtom, () => {
            seen.push("first")
            stopFirst()
        })
        second.sub(keyboardAtom, () => seen.push("second"))

        kb.down("KeyA", "a")
        kb.down("KeyB", "b")
        expect(seen).toEqual(["first", "second", "second"])

        first.dispose()
        second.dispose()
    })

    test("an invalidator registered mid-delivery waits for the next event", () => {
        // Valdres subscribers cannot call `sub`, so drive the hub directly.
        const hub = activateKeyboardHub()!
        const seen: string[] = []
        let stopLate = () => {}
        const stopFirst = hub.keyboard.subscribe(() => {
            seen.push("first")
            if (seen.length === 1)
                stopLate = hub.keyboard.subscribe(() => seen.push("late"))
        })

        kb.down("KeyA", "a")
        expect(seen).toEqual(["first"])
        kb.down("KeyB", "b")
        expect(seen).toEqual(["first", "first", "late"])

        stopFirst()
        stopLate()
        expect(kb.invalidators()).toBe(0)
    })

    test("a subscriber may not subscribe another store during delivery", () => {
        const first = store()
        const late = store()
        const seen: string[] = []
        first.sub(keyboardAtom, () => {
            seen.push("first")
            late.sub(keyboardAtom, () => seen.push("late"))
        })

        kb.down("KeyA", "a")
        expect(seen).toEqual(["first"])
        expect((kb.reported()[0] as Error).name).toBe(
            "SubscriberNotificationError",
        )
        expect(kb.invalidators()).toBe(1)

        first.dispose()
        late.dispose()
    })

    test("a native event dispatched from a subscriber is observed by every store", () => {
        const first = store()
        const second = store()
        const seenFirst: string[] = []
        const seenSecond: string[] = []
        first.sub(keyboardAtom, () => {
            const codes = codesOf(first)()
            seenFirst.push(codes.join())
            if (codes.length === 1) kb.down("KeyB", "b")
        })
        second.sub(keyboardAtom, () =>
            seenSecond.push(codesOf(second)().join()),
        )

        kb.down("KeyA", "a")

        expect(seenFirst.at(-1)).toBe("KeyA,KeyB")
        expect(seenSecond.at(-1)).toBe("KeyA,KeyB")
        expect(kb.reported()).toEqual([])

        first.dispose()
        second.dispose()
    })
})

describe("focus loss", () => {
    test("window blur resets pressed keys and locks, delivered as a source event", () => {
        const app = store()
        const seen: string[] = []
        kb.setLock("CapsLock", true)
        app.sub(keyboardAtom, () => {
            const snapshot = app.get(keyboardAtom)
            seen.push(`${snapshot.pressed.length}:${snapshot.locks.CapsLock}`)
        })

        kb.down("KeyA", "A")
        kb.blur()
        expect(seen).toEqual(["1:true", "0:null"])
        expect(app.get(keyboardAtom)).toBe(EMPTY_KEYBOARD_SNAPSHOT)

        // The next event re-seeds locks.
        kb.setLock("CapsLock", false)
        kb.down("KeyB", "b")
        expect(seen.at(-1)).toBe("1:false")

        app.dispose()
    })

    test("the page becoming hidden resets; becoming visible does not", () => {
        const app = store()
        let notifications = 0
        app.sub(keyboardAtom, () => notifications++)

        kb.down("KeyA", "a")
        kb.setVisibility("visible")
        expect(notifications).toBe(1)

        kb.setVisibility("hidden")
        expect(notifications).toBe(2)
        expect(app.get(keyboardAtom)).toBe(EMPTY_KEYBOARD_SNAPSHOT)

        app.dispose()
    })

    test("a reset with nothing observed publishes nothing", () => {
        const app = store()
        let notifications = 0
        app.sub(keyboardAtom, () => notifications++)
        kb.blur()
        kb.setVisibility("hidden")
        expect(notifications).toBe(0)
        app.dispose()
    })

    test("a reset while nobody subscribes is observed by the next reader", () => {
        const app = store()
        app.sub(keyboardAtom, () => {})()
        kb.down("KeyA", "a")
        kb.blur()
        expect(app.get(keyboardAtom)).toBe(EMPTY_KEYBOARD_SNAPSHOT)
        app.dispose()
    })
})

describe("read-only browser truth", () => {
    test("store writes are rejected at runtime", () => {
        const app = store()
        const loose = app as unknown as Record<
            string,
            (...args: unknown[]) => void
        >
        expect(() => loose.set!(keyboardAtom, EMPTY_KEYBOARD_SNAPSHOT)).toThrow(
            TypeError,
        )
        expect(() => loose.reset!(keyboardAtom)).toThrow(TypeError)
        expect(() =>
            loose.update!(keyboardAtom, () => EMPTY_KEYBOARD_SNAPSHOT),
        ).toThrow(TypeError)
        expect(() => loose.set!(pressedCodesSelector, [])).toThrow(TypeError)
        app.dispose()
    })
})
