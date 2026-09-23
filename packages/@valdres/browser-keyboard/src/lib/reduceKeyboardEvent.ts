import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"
import type { PressedKey } from "../types/PressedKey"
import type { ToggleKey } from "../types/ToggleKey"
import { isToggleKey, TOGGLE_KEYS } from "./toggleKeys"

type Locks = KeyboardSnapshot["locks"]

const isMeta = (code: string) => code === "MetaLeft" || code === "MetaRight"

const sameEntries = (a: readonly PressedKey[], b: readonly PressedKey[]) =>
    a.length === b.length && a.every((entry, index) => entry === b[index])

const nextLocks = (current: Locks, event: KeyboardEvent): Locks => {
    // Locks are seeded together from the first accepted event, so one null
    // means none has been observed since activation or the last reset.
    const seed = current.CapsLock === null
    const updates: ToggleKey[] = seed
        ? [...TOGGLE_KEYS]
        : isToggleKey(event.code)
          ? [event.code]
          : []
    let changed = false
    const next = { ...current }
    for (const lock of updates) {
        const value = event.getModifierState(lock)
        if (next[lock] !== value) {
            next[lock] = value
            changed = true
        }
    }
    return changed ? Object.freeze(next) : current
}

const nextPressed = (
    current: readonly PressedKey[],
    event: KeyboardEvent,
    appleLike: boolean,
): readonly PressedKey[] => {
    const { code } = event
    if (event.type === "keyup") {
        // On macOS, releasing Meta clears everything: the OS swallows keyup for
        // keys pressed while Meta was held, so what is still down is unknown.
        if (appleLike && isMeta(code)) return []
        return current.filter(entry => entry.code !== code)
    }

    let next = current
    // On macOS, keyup never fires for keys pressed while Meta is held, so each
    // new keydown truncates back to the held Meta.
    if (appleLike) {
        const meta = Math.max(
            current.findIndex(entry => entry.code === "MetaLeft"),
            current.findIndex(entry => entry.code === "MetaRight"),
        )
        if (meta !== -1) next = current.slice(0, meta + 1)
    }
    if (next.some(entry => entry.code === code)) return next
    // A repeat, or the same key re-pressed after truncation, keeps the entry of
    // its first observed press.
    const existing = current.find(entry => entry.code === code)
    const pressed: PressedKey =
        existing ??
        Object.freeze({
            code,
            key: event.key,
            timeStamp: event.timeStamp,
            target: event.target,
        })
    return [...next, pressed]
}

/**
 * Applies one native `keydown`/`keyup` to the observed state. Pure: returns the
 * same `current` object when the event changes nothing, so an unchanged
 * snapshot keeps its identity and publishes no invalidation.
 */
export const reduceKeyboardEvent = (
    current: KeyboardSnapshot,
    event: KeyboardEvent,
    appleLike: boolean,
): KeyboardSnapshot => {
    if (event.type !== "keydown" && event.type !== "keyup") return current

    // IME composition (CJK, Vietnamese…) fires keydowns with keyCode 229 that
    // are not real presses. A keyup during composition still releases a key
    // tracked before it began, or that key would stay pressed until a reset.
    if (event.isComposing || event.keyCode === 229) {
        if (event.type !== "keyup") return current
        const pressed = current.pressed.filter(entry => entry.code !== event.code)
        if (pressed.length === current.pressed.length) return current
        return Object.freeze({ pressed: Object.freeze(pressed), locks: current.locks })
    }

    const locks = nextLocks(current.locks, event)
    // Toggle keys are reported through `locks`, never as held keys.
    const candidate = isToggleKey(event.code)
        ? current.pressed
        : nextPressed(current.pressed, event, appleLike)
    const pressed = sameEntries(candidate, current.pressed)
        ? current.pressed
        : Object.freeze(candidate)

    if (pressed === current.pressed && locks === current.locks) return current
    return Object.freeze({ pressed, locks })
}
