/**
 * Package-local Happy-DOM harness for the keyboard hub.
 *
 * It dispatches real `KeyboardEvent`s through Happy-DOM's own `document`, so
 * the hub's actual native listeners run, and counts the DISTINCT listener
 * functions physically attached per target and type. That count is the
 * physical hub; `hub.invalidators()` is the separate Valdres registration
 * count. Tests assert both.
 *
 * Only what a synthetic event cannot carry is patched on the instance:
 * `getModifierState` for lock state and `keyCode` for the legacy IME signal.
 * Synthetic events are untrusted; they establish dispatch and bookkeeping, not
 * OS keyboard state.
 */
import { peekKeyboardHub, resetKeyboardHub } from "../../src/lib/keyboardHubs"
import type { ToggleKey } from "../../src/types/ToggleKey"

type Listener = EventListenerOrEventListenerObject
type Target = "document" | "window"

const HUB_TYPES = [
    "document:keydown",
    "document:keyup",
    "document:visibilitychange",
    "window:blur",
]

export interface KeyInit {
    readonly repeat?: boolean
    readonly isComposing?: boolean
    readonly keyCode?: number
    readonly ctrlKey?: boolean
    readonly shiftKey?: boolean
    readonly altKey?: boolean
    readonly metaKey?: boolean
    readonly target?: EventTarget
}

export interface KeyboardHarness {
    down(code: string, key: string, init?: KeyInit): KeyboardEvent
    up(code: string, key: string, init?: KeyInit): KeyboardEvent
    /** Lock state reported by `getModifierState` on subsequent events. */
    setLock(lock: ToggleKey, on: boolean): void
    blur(): void
    setVisibility(state: DocumentVisibilityState): void
    /** Distinct listener functions attached to that target for that type. */
    listeners(target: Target, type: string): number
    /** Distinct listeners of the four types the hub owns, across both targets. */
    physical(): number
    /** Distinct listeners by `target:type`, for diagnosing a count. */
    attached(): Readonly<Record<string, number>>
    /** Registered store invalidators on the current hub, or 0 if unactivated. */
    invalidators(): number
    /** Errors the platform reported from listeners, in occurrence order. */
    reported(): readonly unknown[]
    /** Make the next `addEventListener` of `type` on `target` throw. */
    failOnAttach(target: Target, type: string, error: unknown): void
    restore(): void
}

export const installKeyboardHarness = (): KeyboardHarness => {
    resetKeyboardHub()
    const locks: Record<ToggleKey, boolean> = {
        CapsLock: false,
        NumLock: false,
        ScrollLock: false,
    }
    const registered = new Map<string, Set<Listener>>()
    const failures = new Map<string, unknown>()
    const reported: unknown[] = []
    const restorers: (() => void)[] = []

    const track = (name: Target, target: EventTarget) => {
        const add = target.addEventListener
        const remove = target.removeEventListener
        target.addEventListener = function (
            type: string,
            listener,
            ...rest: unknown[]
        ) {
            const key = `${name}:${type}`
            if (failures.has(key)) {
                const error = failures.get(key)
                failures.delete(key)
                throw error
            }
            if (listener) {
                const set = registered.get(key) ?? new Set()
                set.add(listener)
                registered.set(key, set)
            }
            return (add as (...args: unknown[]) => void).call(
                this,
                type,
                listener,
                ...rest,
            )
        }
        target.removeEventListener = function (
            type: string,
            listener,
            ...rest: unknown[]
        ) {
            if (listener) registered.get(`${name}:${type}`)?.delete(listener)
            return (remove as (...args: unknown[]) => void).call(
                this,
                type,
                listener,
                ...rest,
            )
        }
        restorers.push(() => {
            target.addEventListener = add
            target.removeEventListener = remove
        })
    }
    track("document", document)
    track("window", window)

    const onError = (event: Event) => {
        reported.push((event as ErrorEvent).error)
        event.preventDefault()
    }
    window.addEventListener("error", onError)
    restorers.push(() => window.removeEventListener("error", onError))

    let visibility: DocumentVisibilityState = "visible"
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibility,
    })
    restorers.push(() => {
        delete (document as { visibilityState?: unknown }).visibilityState
    })

    const dispatch = (
        type: "keydown" | "keyup",
        code: string,
        key: string,
        init: KeyInit = {},
    ) => {
        const { target = document, keyCode, ...flags } = init
        const event = new KeyboardEvent(type, {
            code,
            key,
            bubbles: true,
            cancelable: true,
            ...flags,
        })
        const snapshot = { ...locks }
        Object.defineProperty(event, "getModifierState", {
            value: (name: string) => snapshot[name as ToggleKey] ?? false,
        })
        if (keyCode !== undefined)
            Object.defineProperty(event, "keyCode", { value: keyCode })
        target.dispatchEvent(event)
        return event
    }

    return {
        down: (code, key, init) => dispatch("keydown", code, key, init),
        up: (code, key, init) => dispatch("keyup", code, key, init),
        setLock: (lock, on) => {
            locks[lock] = on
        },
        blur: () => {
            window.dispatchEvent(new Event("blur"))
        },
        setVisibility: state => {
            visibility = state
            document.dispatchEvent(new Event("visibilitychange"))
        },
        listeners: (target, type) =>
            registered.get(`${target}:${type}`)?.size ?? 0,
        physical: () =>
            HUB_TYPES.reduce(
                (sum, key) => sum + (registered.get(key)?.size ?? 0),
                0,
            ),
        attached: () =>
            Object.fromEntries(
                [...registered].map(([key, set]) => [key, set.size]),
            ),
        invalidators: () => peekKeyboardHub()?.invalidators() ?? 0,
        reported: () => [...reported],
        failOnAttach: (target, type, error) => {
            failures.set(`${target}:${type}`, error)
        },
        restore: () => {
            resetKeyboardHub()
            for (const restore of restorers.splice(0).reverse()) restore()
        },
    }
}
