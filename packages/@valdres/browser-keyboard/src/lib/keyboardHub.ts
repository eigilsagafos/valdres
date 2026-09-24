import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"
import type { KeyDown } from "../types/KeyDown"
import { EMPTY_KEYBOARD_SNAPSHOT } from "./emptyKeyboardSnapshot"
import { isAppleLike } from "./isAppleLike"
import { reduceKeyboardEvent } from "./reduceKeyboardEvent"
import { toKeyDown } from "./toKeyDown"

/** One immutable value plus the store-tree invalidators that follow it. */
export interface HubChannel<Value> {
    /** The current value. Reads nothing from the DOM. */
    readonly current: () => Value
    /**
     * Registers one store tree's invalidator. The returned cleanup removes only
     * that registration and is idempotent; it never detaches the hub.
     */
    readonly subscribe: (invalidate: () => void) => () => void
    /** @internal Live invalidator registrations, for tests. */
    readonly invalidators: () => number
}

export interface KeyboardHub {
    /** Pressed keys and locks. Unchanged by repeats. */
    readonly keyboard: HubChannel<KeyboardSnapshot>
    /** The most recent keydown, repeats included; `null` after a reset. */
    readonly lastKeyDown: HubChannel<KeyDown | null>
    /** @internal Removes the native listeners. Tests only; no public teardown. */
    readonly detach: () => void
}

interface Registration {
    readonly invalidate: () => void
}

interface Channel<Value> extends HubChannel<Value> {
    /**
     * Installs `next` and invalidates every registration if it differs from
     * the current value. Collects failures into `failures` instead of throwing,
     * so one channel's failing store cannot stop the other channel's delivery.
     */
    readonly publish: (next: Value, failures: unknown[]) => void
}

const createChannel = <Value>(initial: Value): Channel<Value> => {
    const registrations = new Set<Registration>()
    let value = initial
    return {
        current: () => value,
        publish: (next, failures) => {
            if (Object.is(next, value)) return
            value = next
            for (const registration of [...registrations]) {
                // Skip a registration removed by an earlier invalidation's
                // subscriber; one added during delivery catches up on its own.
                if (!registrations.has(registration)) continue
                try {
                    registration.invalidate()
                } catch (error) {
                    failures.push(error)
                }
            }
        },
        subscribe: invalidate => {
            const registration: Registration = { invalidate }
            registrations.add(registration)
            return () => {
                registrations.delete(registration)
            }
        },
        invalidators: () => registrations.size,
    }
}

const rethrow = (failures: readonly unknown[]) => {
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1)
        throw new AggregateError(failures, "Keyboard invalidation failed")
}

/**
 * One persistent native listener set for a Document: `keydown`/`keyup` and
 * `visibilitychange` on the document, `blur` on its window. The hub owns two
 * channels and keeps tracking with zero registrations; in that state an event
 * only replaces values and does no Valdres work.
 *
 * `keyboard` changes only when pressed keys or locks change, so a repeat costs
 * its subscribers nothing. `lastKeyDown` changes on every observed keydown,
 * repeats included, so only stores that read it pay for repeats. For one event,
 * `keyboard` is delivered first: a `lastKeyDown` subscriber reads settled key
 * state for the same event.
 *
 * Every registration is invalidated after each change, in registration order,
 * even when an earlier one throws. Failures are rethrown once both channels are
 * delivered — the exact error when there is one, an `AggregateError` otherwise
 * — so the platform reports them from the native listener as it would for any
 * throwing listener.
 */
export const createKeyboardHub = (doc: Document): KeyboardHub => {
    const view = doc.defaultView
    const keyboard = createChannel<KeyboardSnapshot>(EMPTY_KEYBOARD_SNAPSHOT)
    const lastKeyDown = createChannel<KeyDown | null>(null)
    let sequence = 0

    const onKey = (event: Event) => {
        const failures: unknown[] = []
        const keyEvent = event as KeyboardEvent
        keyboard.publish(
            reduceKeyboardEvent(keyboard.current(), keyEvent, isAppleLike()),
            failures,
        )
        const keyDown = toKeyDown(keyEvent, sequence + 1)
        if (keyDown !== null) {
            sequence = keyDown.sequence
            lastKeyDown.publish(keyDown, failures)
        }
        rethrow(failures)
    }
    // Focus loss can swallow keyups, so what is still held is unknown, and a
    // keydown from before the reset should not be acted on afterwards.
    const reset = () => {
        const failures: unknown[] = []
        keyboard.publish(EMPTY_KEYBOARD_SNAPSHOT, failures)
        lastKeyDown.publish(null, failures)
        rethrow(failures)
    }
    const onVisibilityChange = () => {
        if (doc.visibilityState === "hidden") reset()
    }

    const attached: [EventTarget, string, (event: Event) => void][] = []
    const detach = () => {
        for (const [target, type, listener] of attached.splice(0))
            target.removeEventListener(type, listener)
    }
    const attach = (
        target: EventTarget,
        type: string,
        listener: (event: Event) => void,
    ) => {
        target.addEventListener(type, listener)
        attached.push([target, type, listener])
    }
    try {
        attach(doc, "keydown", onKey)
        attach(doc, "keyup", onKey)
        attach(doc, "visibilitychange", onVisibilityChange)
        if (view) attach(view, "blur", reset)
    } catch (error) {
        detach()
        throw error
    }

    return { keyboard, lastKeyDown, detach }
}
