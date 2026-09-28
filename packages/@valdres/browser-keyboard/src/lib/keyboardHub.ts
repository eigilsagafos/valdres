import { EMPTY_KEYBOARD_SOURCE_SNAPSHOT } from "./emptyKeyboardSnapshot"
import { isAppleLike } from "./isAppleLike"
import type { KeyboardSourceSnapshot } from "./KeyboardSourceSnapshot"
import { reduceKeyboardEvent } from "./reduceKeyboardEvent"
import { toKeyDown } from "./toKeyDown"

export interface KeyboardHub {
    /** The current immutable source snapshot. Reads nothing from the DOM. */
    readonly snapshot: () => KeyboardSourceSnapshot
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
 * Events applied per native event, counting the native one and every event a
 * subscriber dispatches while it is being delivered.
 */
const MAX_EVENTS_PER_DISPATCH = 64

const rethrow = (failures: readonly unknown[]) => {
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1)
        throw new AggregateError(failures, "Keyboard invalidation failed")
}

/**
 * One persistent native listener set for a Document: `keydown`/`keyup` and
 * `visibilitychange` on the document, `blur` on its window. The hub keeps
 * tracking with zero registrations; in that state an event only replaces the
 * snapshot and does no Valdres work.
 *
 * Each event computes the complete next snapshot — held keys, locks and the
 * latest keydown — and publishes it once. A store therefore settles once per
 * event: a keydown's occurrence and the held state after it arrive together.
 * The held-key part keeps its identity when unchanged, so held-only readers stop
 * propagating at the first projection even on repeats.
 *
 * Events are processed one at a time. An event dispatched from inside a
 * subscriber (a nested keydown, or a blur caused by moving focus) is queued and
 * applied after the current event has been delivered, so `sequence` follows
 * dispatch order. At most 64 events are applied per native event.
 *
 * Every registration is invalidated after each change, in registration order,
 * even when an earlier one throws. Failures are rethrown once the event and
 * anything queued behind it are delivered — the exact error when there is one,
 * an `AggregateError` otherwise — so the platform reports them from the native
 * listener as it would for any throwing listener.
 */
export const createKeyboardHub = (doc: Document): KeyboardHub => {
    const view = doc.defaultView
    const registrations = new Set<Registration>()
    let snapshot = EMPTY_KEYBOARD_SOURCE_SNAPSHOT
    let sequence = 0

    const publish = (next: KeyboardSourceSnapshot, failures: unknown[]) => {
        if (next === snapshot) return
        snapshot = next
        if (registrations.size === 0) return
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
    }

    type Job = (failures: unknown[]) => void
    const queue: Job[] = []
    let delivering = false
    const run = (job: Job) => {
        if (delivering) {
            queue.push(job)
            return
        }
        delivering = true
        const failures: unknown[] = []
        try {
            let processed = 0
            for (let next: Job | undefined = job; next; next = queue.shift()) {
                // Subscribers that keep dispatching events would otherwise
                // drain forever: nested events are queued, so they never nest
                // deep enough for Valdres's own delivery limit to stop them.
                if (++processed > MAX_EVENTS_PER_DISPATCH) {
                    failures.push(
                        new RangeError(
                            `More than ${MAX_EVENTS_PER_DISPATCH} keyboard events were dispatched from subscribers during one native event; the rest were dropped`,
                        ),
                    )
                    break
                }
                // One job failing outside delivery must not drop the events
                // queued behind it or the failures already collected.
                try {
                    next(failures)
                } catch (error) {
                    failures.push(error)
                }
            }
        } finally {
            delivering = false
            queue.length = 0
        }
        rethrow(failures)
    }

    const onKey = (event: Event) =>
        run(failures => {
            const keyEvent = event as KeyboardEvent
            const current = snapshot
            // Reduce first: if the event is malformed, nothing is published.
            const keyboard = reduceKeyboardEvent(
                current.keyboard,
                keyEvent,
                isAppleLike(),
            )
            const keyDown = toKeyDown(keyEvent, sequence + 1)
            if (keyDown !== null) sequence = keyDown.sequence
            const lastKeyDown = keyDown ?? current.lastKeyDown
            if (
                keyboard === current.keyboard &&
                lastKeyDown === current.lastKeyDown
            )
                return
            publish(Object.freeze({ keyboard, lastKeyDown }), failures)
        })
    // Focus loss can swallow keyups, so what is still held is unknown, and a
    // keydown from before the reset should not be acted on afterwards.
    const reset = () =>
        run(failures => publish(EMPTY_KEYBOARD_SOURCE_SNAPSHOT, failures))
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
