import { describe, expect, test } from "bun:test"
import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"
import { EMPTY_KEYBOARD_SNAPSHOT } from "./emptyKeyboardSnapshot"
import { reduceKeyboardEvent } from "./reduceKeyboardEvent"

const locks = { CapsLock: false, NumLock: false, ScrollLock: false }

const event = (
    type: "keydown" | "keyup",
    code: string,
    key: string,
    overrides: Partial<KeyboardEvent> = {},
): KeyboardEvent =>
    ({
        type,
        code,
        key,
        keyCode: 0,
        isComposing: false,
        timeStamp: 1,
        getModifierState: (name: string) =>
            locks[name as keyof typeof locks] ?? false,
        ...overrides,
    }) as unknown as KeyboardEvent

const apply = (
    events: KeyboardEvent[],
    { apple = false, from = EMPTY_KEYBOARD_SNAPSHOT } = {},
): KeyboardSnapshot =>
    events.reduce(
        (state, next) => reduceKeyboardEvent(state, next, apple),
        from,
    )

const codes = (state: KeyboardSnapshot) => state.pressed.map(k => k.code)

describe("reduceKeyboardEvent", () => {
    test("tracks presses and releases in press order", () => {
        const state = apply([
            event("keydown", "KeyA", "a"),
            event("keydown", "KeyB", "b"),
            event("keyup", "KeyA", "a"),
        ])
        expect(codes(state)).toEqual(["KeyB"])
    })

    test("records key, code and first timeStamp", () => {
        const state = apply([
            event("keydown", "KeyA", "a", { timeStamp: 5 }),
            event("keydown", "KeyA", "a", { timeStamp: 9, repeat: true }),
        ])
        expect(state.pressed).toEqual([
            { code: "KeyA", key: "a", timeStamp: 5 },
        ])
    })

    test("a repeat returns the same snapshot object", () => {
        const pressed = apply([event("keydown", "KeyA", "a")])
        expect(
            reduceKeyboardEvent(
                pressed,
                event("keydown", "KeyA", "a", { repeat: true }),
                false,
            ),
        ).toBe(pressed)
    })

    test("releasing an untracked key returns the same snapshot object", () => {
        const pressed = apply([event("keydown", "KeyA", "a")])
        expect(
            reduceKeyboardEvent(pressed, event("keyup", "KeyZ", "z"), false),
        ).toBe(pressed)
    })

    test("other event types change nothing", () => {
        const pressed = apply([event("keydown", "KeyA", "a")])
        expect(
            reduceKeyboardEvent(
                pressed,
                event("keypress" as "keydown", "KeyB", "b"),
                false,
            ),
        ).toBe(pressed)
    })

    test("keyup removes by code regardless of key case", () => {
        const state = apply([
            event("keydown", "KeyA", "A"),
            event("keyup", "KeyA", "a"),
        ])
        expect(state.pressed).toEqual([])
    })

    test("modifier flags on an event never invent unobserved presses", () => {
        const state = apply([
            event("keydown", "KeyS", "s", {
                ctrlKey: true,
                metaKey: true,
                shiftKey: true,
            }),
        ])
        expect(codes(state)).toEqual(["KeyS"])
    })

    test("snapshots, their arrays and entries are frozen", () => {
        const state = apply([event("keydown", "KeyA", "a")])
        expect(Object.isFrozen(state)).toBe(true)
        expect(Object.isFrozen(state.pressed)).toBe(true)
        expect(Object.isFrozen(state.pressed[0])).toBe(true)
        expect(Object.isFrozen(state.locks)).toBe(true)
        expect(Object.isFrozen(EMPTY_KEYBOARD_SNAPSHOT)).toBe(true)
    })

    describe("IME composition", () => {
        test("ignores composing keydowns", () => {
            expect(
                apply([event("keydown", "KeyA", "a", { isComposing: true })]),
            ).toBe(EMPTY_KEYBOARD_SNAPSHOT)
            expect(
                apply([event("keydown", "KeyA", "Process", { keyCode: 229 })]),
            ).toBe(EMPTY_KEYBOARD_SNAPSHOT)
        })

        test("a composing keyup still releases a key tracked before composition", () => {
            const state = apply([
                event("keydown", "ShiftLeft", "Shift"),
                event("keyup", "ShiftLeft", "Shift", { isComposing: true }),
            ])
            expect(state.pressed).toEqual([])
        })

        test("a composing keyup of an untracked key changes nothing", () => {
            const pressed = apply([event("keydown", "KeyA", "a")])
            expect(
                reduceKeyboardEvent(
                    pressed,
                    event("keyup", "KeyB", "b", { isComposing: true }),
                    false,
                ),
            ).toBe(pressed)
        })
    })

    describe("Apple Meta recovery", () => {
        test("truncates keys pressed while Meta is held", () => {
            const state = apply(
                [
                    event("keydown", "MetaLeft", "Meta"),
                    event("keydown", "KeyA", "a"),
                    event("keydown", "KeyB", "b"),
                ],
                { apple: true },
            )
            expect(codes(state)).toEqual(["MetaLeft", "KeyB"])
        })

        test("handles MetaRight the same as MetaLeft", () => {
            const state = apply(
                [
                    event("keydown", "MetaRight", "Meta"),
                    event("keydown", "KeyA", "a"),
                    event("keydown", "KeyB", "b"),
                ],
                { apple: true },
            )
            expect(codes(state)).toEqual(["MetaRight", "KeyB"])
        })

        test("releasing Meta clears every key, including those pressed before it", () => {
            const state = apply(
                [
                    event("keydown", "KeyA", "a"),
                    event("keydown", "MetaLeft", "Meta"),
                    event("keydown", "Minus", "-"),
                    event("keyup", "MetaLeft", "Meta"),
                ],
                { apple: true },
            )
            expect(state.pressed).toEqual([])
        })

        test("modifiers pressed after Meta survive the next keydown (Cmd+Shift+Z)", () => {
            const state = apply(
                [
                    event("keydown", "MetaLeft", "Meta"),
                    event("keydown", "ShiftLeft", "Shift"),
                    event("keydown", "KeyA", "a"),
                    event("keydown", "KeyZ", "z"),
                ],
                { apple: true },
            )
            expect(codes(state)).toEqual(["MetaLeft", "ShiftLeft", "KeyZ"])
        })

        test("keys pressed between two held Metas are dropped; both Metas stay", () => {
            const state = apply(
                [
                    event("keydown", "MetaLeft", "Meta"),
                    event("keydown", "KeyA", "a"),
                    event("keydown", "MetaRight", "Meta"),
                    event("keydown", "KeyB", "b"),
                ],
                { apple: true },
            )
            expect(codes(state)).toEqual(["MetaLeft", "MetaRight", "KeyB"])
        })

        test("releasing one Meta keeps the other Meta and other held modifiers", () => {
            const state = apply(
                [
                    event("keydown", "MetaLeft", "Meta"),
                    event("keydown", "ShiftLeft", "Shift"),
                    event("keydown", "MetaRight", "Meta"),
                    event("keydown", "KeyK", "k"),
                    event("keyup", "MetaLeft", "Meta"),
                ],
                { apple: true },
            )
            expect(codes(state)).toEqual(["ShiftLeft", "MetaRight"])
        })

        test("a repeat while Meta is held keeps the snapshot and first press", () => {
            const held = apply(
                [
                    event("keydown", "MetaLeft", "Meta"),
                    event("keydown", "KeyA", "a", { timeStamp: 3 }),
                ],
                { apple: true },
            )
            const repeated = reduceKeyboardEvent(
                held,
                event("keydown", "KeyA", "a", { timeStamp: 7, repeat: true }),
                true,
            )
            expect(repeated).toBe(held)
            expect(repeated.pressed[1]?.timeStamp).toBe(3)
        })

        test("does not truncate on other platforms", () => {
            const state = apply([
                event("keydown", "MetaLeft", "Meta"),
                event("keydown", "KeyA", "a"),
                event("keydown", "KeyB", "b"),
            ])
            expect(codes(state)).toEqual(["MetaLeft", "KeyA", "KeyB"])
        })
    })

    describe("lock keys", () => {
        const withLocks = (values: Partial<typeof locks>, fn: () => void) => {
            const saved = { ...locks }
            Object.assign(locks, values)
            try {
                fn()
            } finally {
                Object.assign(locks, saved)
            }
        }

        test("start unknown and are seeded together by the first accepted event", () => {
            expect(EMPTY_KEYBOARD_SNAPSHOT.locks).toEqual({
                CapsLock: null,
                NumLock: null,
                ScrollLock: null,
            })
            withLocks({ CapsLock: true, NumLock: true }, () => {
                const state = apply([event("keydown", "KeyA", "a")])
                expect(state.locks).toEqual({
                    CapsLock: true,
                    NumLock: true,
                    ScrollLock: false,
                })
            })
        })

        test("after seeding, only the lock's own key updates it", () => {
            const seeded = apply([event("keydown", "KeyA", "a")])
            withLocks({ CapsLock: true }, () => {
                const other = reduceKeyboardEvent(
                    seeded,
                    event("keydown", "KeyB", "b"),
                    false,
                )
                expect(other.locks).toBe(seeded.locks)
                const caps = reduceKeyboardEvent(
                    other,
                    event("keydown", "CapsLock", "CapsLock"),
                    false,
                )
                expect(caps.locks).toEqual({
                    CapsLock: true,
                    NumLock: false,
                    ScrollLock: false,
                })
            })
        })

        test("lock keys never appear as pressed keys", () => {
            const state = apply([
                event("keydown", "KeyA", "a"),
                event("keydown", "CapsLock", "CapsLock"),
                event("keyup", "CapsLock", "CapsLock"),
            ])
            expect(codes(state)).toEqual(["KeyA"])
        })

        test("composing events do not seed locks", () => {
            const state = apply([
                event("keydown", "KeyA", "a", { isComposing: true }),
            ])
            expect(state.locks.CapsLock).toBe(null)
        })
    })
})
