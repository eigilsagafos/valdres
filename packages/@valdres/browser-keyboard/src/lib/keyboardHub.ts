import { EMPTY_KEYBOARD_SOURCE_SNAPSHOT } from "./emptyKeyboardSnapshot"
import { isAppleLike } from "./isAppleLike"
import type { KeyboardSourceSnapshot } from "./KeyboardSourceSnapshot"
import { isEditableTarget } from "./isEditableTarget"
import { reduceKeyboardEvent } from "./reduceKeyboardEvent"
import { toKeyDown, type KeyDownObservation } from "./toKeyDown"

export interface KeyboardHub {
    /** The current immutable source snapshot. Reads nothing from the DOM. */
    readonly snapshot: () => KeyboardSourceSnapshot
    /**
     * Registers one store tree's invalidator. The returned cleanup removes only
     * that registration and is idempotent; it never detaches the hub.
     */
    readonly subscribe: (invalidate: () => void) => () => void
    /**
     * Cancels the native keydown that produced `sequence` if it is the one
     * being delivered right now and its dispatch has not finished. Returns
     * whether its default is now prevented.
     */
    readonly preventDefault: (sequence: number) => boolean
    /** The sequence of the latest observed keydown; 0 before any. */
    readonly sequence: () => number
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
    // The keydown being delivered, for exactly the duration of its own
    // publication. Never part of a snapshot.
    let live: {
        readonly sequence: number
        readonly event: KeyboardEvent
    } | null = null

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

    const onKey = (event: Event) => {
        const keyEvent = event as KeyboardEvent
        // Read on arrival, not when the job runs: a keydown dispatched from a
        // subscriber is queued and applied after its dispatch has finished, when
        // later listeners may have cancelled it and its composed path is gone.
        const observation: KeyDownObservation | null =
            keyEvent.type === "keydown"
                ? {
                      editable: isEditableTarget(keyEvent),
                      defaultPrevented: keyEvent.defaultPrevented,
                  }
                : null
        run(failures => {
            const current = snapshot
            // Reduce first: if the event is malformed, nothing is published.
            const keyboard = reduceKeyboardEvent(
                current.keyboard,
                keyEvent,
                isAppleLike(),
            )
            const keyDown =
                observation === null
                    ? null
                    : toKeyDown(keyEvent, sequence + 1, observation)
            if (keyDown !== null) sequence = keyDown.sequence
            const lastKeyDown = keyDown ?? current.lastKeyDown
            if (
                keyboard === current.keyboard &&
                lastKeyDown === current.lastKeyDown
            )
                return
            if (keyDown !== null)
                live = { sequence: keyDown.sequence, event: keyEvent }
            try {
                publish(Object.freeze({ keyboard, lastKeyDown }), failures)
            } finally {
                live = null
            }
        })
    }
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
        preventDefault: target => {
            if (live === null || live.sequence !== target) return false
            const { event } = live
            // A queued keydown is applied after its own dispatch has returned;
            // cancelling it then would claim a default the platform has
            // already acted on.
            if (event.eventPhase === 0 || !event.cancelable) return false
            event.preventDefault()
            return event.defaultPrevented
        },
        sequence: () => sequence,
        invalidators: () => registrations.size,
        detach,
    }
}
