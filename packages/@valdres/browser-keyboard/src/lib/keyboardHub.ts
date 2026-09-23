import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"
import { EMPTY_KEYBOARD_SNAPSHOT } from "./emptyKeyboardSnapshot"
import { isAppleLike } from "./isAppleLike"
import { reduceKeyboardEvent } from "./reduceKeyboardEvent"

export interface KeyboardHub {
    /** The current immutable snapshot. Reads nothing from the DOM. */
    readonly snapshot: () => KeyboardSnapshot
    /**
     * Registers one store tree's invalidator. The returned cleanup removes only
     * that registration and is idempotent; it never detaches the hub.
     */
    readonly subscribe: (invalidate: () => void) => () => void
    /** @internal Live invalidator registrations, for tests. */
    readonly invalidators: () => number
    /** @internal Removes the native listeners. Tests only; no public teardown. */
    readonly detach: () => void
}

interface Registration {
    readonly invalidate: () => void
}

/**
 * One persistent native listener set for a Document: `keydown`/`keyup` and
 * `visibilitychange` on the document, `blur` on its window. The hub owns the
 * current snapshot and keeps tracking with zero registrations; in that state
 * an event only replaces the snapshot and does no Valdres work.
 *
 * Every registration is invalidated after each change, in registration order,
 * even when an earlier one throws. Failures are rethrown once delivery is
 * complete — the exact error when there is one, an `AggregateError` otherwise —
 * so the platform reports them from the native listener as it would for any
 * throwing listener.
 */
export const createKeyboardHub = (doc: Document): KeyboardHub => {
    const view = doc.defaultView
    const registrations = new Set<Registration>()
    let snapshot = EMPTY_KEYBOARD_SNAPSHOT

    const publish = (next: KeyboardSnapshot) => {
        if (next === snapshot) return
        snapshot = next
        if (registrations.size === 0) return
        const failures: unknown[] = []
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
        if (failures.length === 1) throw failures[0]
        if (failures.length > 1)
            throw new AggregateError(failures, "Keyboard invalidation failed")
    }

    const onKey = (event: Event) =>
        publish(reduceKeyboardEvent(snapshot, event as KeyboardEvent, isAppleLike()))
    // Focus loss can swallow keyups, so what is still held is unknown.
    const onBlur = () => publish(EMPTY_KEYBOARD_SNAPSHOT)
    const onVisibilityChange = () => {
        if (doc.visibilityState === "hidden") publish(EMPTY_KEYBOARD_SNAPSHOT)
    }

    const attached: [EventTarget, string, (event: Event) => void][] = []
    const detach = () => {
        for (const [target, type, listener] of attached.splice(0))
            target.removeEventListener(type, listener)
    }
    const attach = (target: EventTarget, type: string, listener: (event: Event) => void) => {
        target.addEventListener(type, listener)
        attached.push([target, type, listener])
    }
    try {
        attach(doc, "keydown", onKey)
        attach(doc, "keyup", onKey)
        attach(doc, "visibilitychange", onVisibilityChange)
        if (view) attach(view, "blur", onBlur)
    } catch (error) {
        detach()
        throw error
    }

    return {
        snapshot: () => snapshot,
        subscribe: invalidate => {
            const registration: Registration = { invalidate }
            registrations.add(registration)
            return () => {
                registrations.delete(registration)
            }
        },
        invalidators: () => registrations.size,
        detach,
    }
}
