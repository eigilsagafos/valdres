import { strict as assert } from "node:assert"
import {
    atom,
    externalAtom,
    family,
    selector,
    store,
    ExternalSourceOperationError,
    RuntimeMismatchError,
    SubscriberNotificationError,
    type ExternalSource,
} from "../../../src/index"
// Only the foreign handle comes from the internal factory. The domain being
// exercised, including its first ExternalAtom, uses the public entrypoint.
import { createCommittedStoreTreeDomain } from "../../../src/v1-internal/committed-store-tree/committed-store-tree"

// The test's type-only import keeps this subprocess fixture in the normal
// candidate typecheck without evaluating it in the parent test process.
export type LateInstallScenario =
    | "cold-subscription"
    | "cold-catchup"
    | "propagation"
    | "equal-propagation"
    | "propagation-setup-failure"
    | "cold-admission-failure"
    | "pull-memo"
    | "transaction"
    | "prior-control-fault"
    | "prior-control-notification-fault"
    | "multiple-prior-control-faults"
    | "initial-control-failure"
    | "operation-phase-reset"

const thrown = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const source = (initial: number, onSubscribe?: (attempt: number) => void) => {
    let value = initial
    const listeners = new Set<() => void>()
    const invalidators: (() => void)[] = []
    const counts = { samples: 0, attempts: 0, cleanups: 0 }
    const adapter: ExternalSource<number> = {
        getSnapshot() {
            counts.samples++
            return value
        },
        subscribe(invalidate) {
            counts.attempts++
            invalidators.push(invalidate)
            onSubscribe?.(counts.attempts)
            listeners.add(invalidate)
            return () => {
                counts.cleanups++
                listeners.delete(invalidate)
            }
        },
    }
    return {
        adapter,
        counts,
        listeners,
        invalidators,
        set(next: number) {
            value = next
        },
        publish(next: number) {
            value = next
            for (const invalidate of [...listeners]) invalidate()
        },
    }
}

const scenario = process.argv[2]
if (scenario === "cold-subscription" || scenario === "cold-catchup") {
    const catchup = scenario === "cold-catchup"
    const hub = source(1, () => {
        if (catchup) hub.set(2)
    })
    let factories = 0
    const member = family((_id: number) => {
        factories++
        return externalAtom(hub.adapter)
    })
    const selected = selector(get => get(member(1)))
    const app = store()
    const seen: number[] = []
    const stop = app.sub(selected, () => seen.push(app.get(selected)))
    assert.equal(factories, 1)
    assert.deepEqual(hub.counts, { samples: 2, attempts: 1, cleanups: 0 })
    assert.equal(app.get(selected), catchup ? 2 : 1)
    assert.equal(hub.counts.samples, 2)
    assert.deepEqual(seen, catchup ? [2] : [])
    hub.publish(3)
    assert.deepEqual(seen, catchup ? [2, 3] : [3])
    stop()
    stop()
    assert.equal(hub.listeners.size, 0)
    assert.equal(hub.counts.cleanups, 1)
    const samples = hub.counts.samples
    for (const invalidate of hub.invalidators) invalidate()
    assert.equal(hub.counts.samples, samples)
    app.dispose()
    assert.equal(hub.counts.cleanups, 1)
} else if (scenario === "propagation" || scenario === "equal-propagation") {
    const equal = scenario === "equal-propagation"
    const enabled = atom(false)
    const hub = source(equal ? 0 : 1, () => {
        if (!equal) hub.set(2)
    })
    let factories = 0
    const member = family((_id: number) => {
        factories++
        return externalAtom(hub.adapter)
    })
    const selected = selector(get => (get(enabled) ? get(member(1)) : 0))
    const app = store()
    const seen: number[] = []
    const stop = app.sub(selected, () => seen.push(app.get(selected)))
    assert.equal(factories, 0)
    assert.deepEqual(hub.counts, { samples: 0, attempts: 0, cleanups: 0 })
    app.set(enabled, true)
    assert.equal(app.get(enabled), true)
    assert.equal(app.get(selected), equal ? 0 : 2)
    assert.deepEqual(seen, equal ? [] : [2])
    assert.deepEqual(hub.counts, { samples: 2, attempts: 1, cleanups: 0 })
    assert.equal(factories, 1)
    hub.publish(3)
    assert.deepEqual(seen, equal ? [3] : [2, 3])
    stop()
    assert.equal(hub.counts.cleanups, 1)
    assert.equal(hub.listeners.size, 0)
    app.dispose()
} else if (scenario === "propagation-setup-failure") {
    const enabled = atom(false)
    const setupError = new Error("late setup failure")
    const callbackError = new Error("existing subscriber failure")
    const hub = source(1, attempt => {
        if (attempt === 1) throw setupError
    })
    const member = family((_id: number) => externalAtom(hub.adapter))
    const selected = selector(get => (get(enabled) ? get(member(1)) : 0))
    const app = store()
    const callbacks: string[] = []
    const stopFirst = app.sub(selected, () => {
        callbacks.push("first")
        throw callbackError
    })
    const stopLast = app.sub(selected, () => callbacks.push("last"))

    const error = thrown(() => app.set(enabled, true))

    assert.ok(error instanceof ExternalSourceOperationError)
    assert.equal(app.get(enabled), true)
    assert.deepEqual(callbacks, ["first", "last"])
    assert.equal(hub.counts.attempts, 1)
    assert.equal(hub.listeners.size, 0)
    assert.equal(hub.counts.cleanups, 0)
    assert.deepEqual(error.causes, [setupError, callbackError])
    assert.equal(error.causes[0], setupError)
    assert.equal(error.causes[1], callbackError)
    assert.deepEqual(error.failures, [
        {
            cause: setupError,
            committed: true,
            phase: "admitting",
            source: "external-startup",
        },
        {
            cause: callbackError,
            committed: true,
            phase: "notifying",
            source: "owned-mutation",
        },
    ])
    assert.ok(Object.isFrozen(error))
    assert.ok(Object.isFrozen(error.failures))
    for (const failure of error.failures) assert.ok(Object.isFrozen(failure))
    const samples = hub.counts.samples
    hub.invalidators[0]!()
    assert.equal(hub.counts.samples, samples)
    // Retry must preserve the original registrations. An unchanged successful
    // catch-up emits no extra callback and acquires exactly one generation.
    assert.equal(app.get(selected), 1)
    assert.equal(hub.counts.attempts, 2)
    assert.equal(hub.listeners.size, 1)
    assert.deepEqual(callbacks, ["first", "last"])
    stopFirst()
    assert.equal(hub.counts.cleanups, 0)
    stopLast()
    assert.equal(hub.counts.cleanups, 1)
    app.dispose()
} else if (scenario === "cold-admission-failure") {
    const cause = new Error("startup subscriber")
    const hub = source(0, attempt => hub.set(attempt))
    const member = family((_id: number) => externalAtom(hub.adapter))
    const selected = selector(get => get(member(1)))
    const app = store()
    let callbacks = 0
    const error = thrown(() =>
        app.sub(selected, () => {
            callbacks++
            throw cause
        }),
    )
    assert.ok(error instanceof SubscriberNotificationError)
    assert.equal(error.cause, cause)
    assert.deepEqual(error.causes, [cause])
    assert.equal(error.source, "external-startup")
    assert.equal(error.committed, true)
    assert.equal(error.phase, "notifying")
    assert.ok(Object.isFrozen(error))
    assert.ok(Object.isFrozen(error.causes))
    assert.equal(callbacks, 1)
    assert.equal(hub.counts.attempts, 1)
    assert.equal(hub.counts.cleanups, 1)
    assert.equal(hub.listeners.size, 0)
    const stale = hub.invalidators[0]!
    const samples = hub.counts.samples
    stale()
    assert.equal(hub.counts.samples, samples)
    const seen: number[] = []
    const stop = app.sub(selected, () => seen.push(app.get(selected)))
    assert.equal(hub.counts.attempts, 2)
    assert.equal(hub.listeners.size, 1)
    assert.deepEqual(seen, [2])
    hub.publish(3)
    assert.deepEqual(seen, [2, 3])
    assert.equal(callbacks, 1)
    stop()
    assert.equal(hub.counts.cleanups, 2)
    const afterStop = hub.counts.samples
    for (const invalidate of hub.invalidators) invalidate()
    assert.equal(hub.counts.samples, afterStop)
    app.dispose()
    assert.equal(hub.counts.cleanups, 2)
} else if (scenario === "pull-memo") {
    let samples = 0,
        attachments = 0
    const member = family((_id: number) =>
        externalAtom({
            getSnapshot: () => ++samples,
            subscribe() {
                attachments++
                return () => {}
            },
        }),
    )
    const selected = selector(get => get(member(1)) + get(member(1)))
    const app = store()
    assert.equal(app.get(selected), 2)
    assert.equal(samples, 1)
    assert.equal(attachments, 0)
    assert.equal(app.get(selected), 4)
    assert.equal(samples, 2)
    assert.equal(attachments, 0)
    app.dispose()
} else if (scenario === "transaction") {
    const enabled = atom(false)
    const hub = source(1)
    const member = family((_id: number) => externalAtom(hub.adapter))
    const selected = selector(get => (get(enabled) ? get(member(1)) : 0))
    const captured = selector(get => get(member(1)) + get(member(1)))
    const app = store()
    const seen: number[] = []
    const stop = app.sub(selected, () => seen.push(app.get(selected)))
    app.txn(tx => {
        assert.equal(tx.get(captured), 2)
        hub.set(3)
        assert.equal(tx.get(captured), 2)
        assert.equal(hub.counts.samples, 1)
        assert.equal(hub.counts.attempts, 0)
        tx.set(enabled, true)
    })
    assert.equal(app.get(enabled), true)
    assert.equal(app.get(selected), 3)
    assert.deepEqual(seen, [3])
    assert.equal(hub.counts.attempts, 1)
    assert.equal(hub.counts.samples, 3)
    stop()
    assert.equal(hub.counts.cleanups, 1)
    app.dispose()
} else if (
    scenario === "prior-control-fault" ||
    scenario === "prior-control-notification-fault"
) {
    const enabled = atom(false)
    const alien = createCommittedStoreTreeDomain().atom(0)
    const events: string[] = []
    const hub = source(1)
    let mismatch: unknown
    const failing = selector(get => {
        if (!get(enabled)) return 0
        events.push("control")
        try {
            return get(alien)
        } catch (error) {
            mismatch = error
            throw error
        }
    })
    const member = family((_id: number) => {
        events.push("definition")
        return externalAtom(hub.adapter)
    })
    const selected = selector(get => (get(enabled) ? get(member(1)) : 0))
    const app = store()
    const callbacks: string[] = []
    const notificationError = new Error("subscriber after prior control fault")
    const stopFault = app.sub(failing, () => {
        callbacks.push("fault")
        if (scenario === "prior-control-notification-fault") {
            throw notificationError
        }
    })
    const stopValue = app.sub(selected, () =>
        callbacks.push(`value:${app.get(selected)}`),
    )
    const error = thrown(() => app.set(enabled, true))
    assert.deepEqual(events, ["control", "definition"])
    assert.ok(mismatch instanceof RuntimeMismatchError)
    if (scenario === "prior-control-notification-fault") {
        assert.ok(error instanceof SubscriberNotificationError)
        assert.deepEqual(error.causes, [mismatch, notificationError])
        assert.equal(error.causes[0], mismatch)
        assert.equal(error.causes[1], notificationError)
        assert.equal(error.source, "owned-mutation")
        assert.equal(error.committed, true)
        assert.ok(Object.isFrozen(error))
        assert.ok(Object.isFrozen(error.causes))
    } else {
        assert.equal(error, mismatch)
    }
    assert.equal(app.get(enabled), true)
    assert.equal(app.get(selected), 1)
    assert.deepEqual(callbacks, ["fault", "value:1"])
    assert.equal(hub.counts.attempts, 1)
    assert.equal(hub.listeners.size, 1)
    stopFault()
    stopValue()
    assert.equal(hub.counts.cleanups, 1)
    app.dispose()
} else if (scenario === "multiple-prior-control-faults") {
    const app = store()
    const enabled = atom(false)
    const alien = createCommittedStoreTreeDomain().atom(0)
    const causes: unknown[] = []
    const callbacks: string[] = []
    const events: string[] = []
    const failing = (name: string) =>
        selector(get => {
            if (!get(enabled)) return 0
            events.push(name)
            try {
                return get(alien)
            } catch (error) {
                causes.push(error)
                throw error
            }
        })
    const first = failing("first fault")
    const second = failing("second fault")
    const hub = source(1)
    const member = family((_id: number) => {
        events.push("definition")
        return externalAtom(hub.adapter)
    })
    const selected = selector(get => (get(enabled) ? get(member(1)) : 0))
    const stops = [
        app.sub(first, () => callbacks.push("first")),
        app.sub(second, () => callbacks.push("second")),
        app.sub(selected, () => callbacks.push("external")),
    ]

    const error = thrown(() => app.set(enabled, true))

    assert.deepEqual(events, ["first fault", "second fault", "definition"])
    assert.equal(causes.length, 2)
    for (const cause of causes) assert.ok(cause instanceof RuntimeMismatchError)
    assert.ok(error instanceof ExternalSourceOperationError)
    assert.deepEqual(error.causes, causes)
    assert.equal(error.causes[0], causes[0])
    assert.equal(error.causes[1], causes[1])
    assert.deepEqual(
        error.failures,
        causes.map(cause => ({
            cause,
            phase: "settling",
            source: "owned-mutation",
            committed: true,
        })),
    )
    assert.ok(Object.isFrozen(error.causes))
    assert.ok(Object.isFrozen(error.failures))
    for (const failure of error.failures) assert.ok(Object.isFrozen(failure))
    assert.equal(app.get(enabled), true)
    assert.equal(app.get(selected), 1)
    assert.deepEqual(callbacks, ["first", "second", "external"])
    assert.equal(hub.counts.attempts, 1)
    assert.equal(hub.listeners.size, 1)
    for (const stop of stops) stop()
    assert.equal(hub.counts.cleanups, 1)
    app.dispose()
} else if (scenario === "initial-control-failure") {
    const app = store()
    const alien = createCommittedStoreTreeDomain().atom(0)
    let mismatch: unknown
    let samples = 0,
        attachments = 0,
        cleanups = 0,
        callbacks = 0
    const member = family((_id: number) =>
        externalAtom({
            getSnapshot() {
                samples++
                try {
                    return app.get(alien)
                } catch (error) {
                    mismatch = error
                    throw error
                }
            },
            subscribe() {
                attachments++
                return () => {
                    cleanups++
                }
            },
        }),
    )
    const selected = selector(get => get(member(1)))
    const error = thrown(() => app.sub(selected, () => callbacks++))
    assert.ok(mismatch instanceof RuntimeMismatchError)
    assert.equal(error, mismatch)
    assert.equal(samples, 1)
    assert.equal(attachments, 0)
    assert.equal(callbacks, 0)
    app.dispose()
    assert.equal(attachments, 0)
    assert.equal(cleanups, 0)
} else if (scenario === "operation-phase-reset") {
    const enabled = atom(false)
    const target = atom(0)
    const setupError = new Error("pending setup")
    const updaterError = new Error("updater")
    const pending = source(1, () => {
        throw setupError
    })
    const trigger = source(0)
    const failing = externalAtom(pending.adapter)
    const active = externalAtom(trigger.adapter)
    const selected = selector(get => (get(enabled) ? get(failing) : 0))
    const app = store()
    assert.equal(app.get(target), 0)
    const stopActive = app.sub(active, () => {})
    const stopPending = app.sub(selected, () => {})
    assert.ok(
        thrown(() => app.set(enabled, true)) instanceof
            ExternalSourceOperationError,
    )
    assert.ok(
        thrown(() => trigger.publish(1)) instanceof
            ExternalSourceOperationError,
    )

    const error = thrown(() =>
        app.update(target, () => {
            throw updaterError
        }),
    )

    assert.ok(error instanceof ExternalSourceOperationError)
    assert.deepEqual(error.failures, [
        {
            cause: updaterError,
            phase: "admitting",
            source: "owned-mutation",
            committed: false,
        },
        {
            cause: setupError,
            phase: "admitting",
            source: "external-startup",
            committed: false,
        },
    ])
    assert.equal(error.causes[0], updaterError)
    assert.equal(error.causes[1], setupError)
    assert.equal(app.get(target), 0)
    assert.equal(pending.counts.attempts, 3)
    stopPending()
    stopActive()
    assert.equal(trigger.counts.cleanups, 1)
    app.dispose()
} else {
    throw new Error(`Unknown scenario: ${scenario}`)
}
console.log(`PASS ${scenario}`)
