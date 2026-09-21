import { expect, test } from "bun:test"
import {
    createCommittedStoreTreeDomain,
    SubscriberNotificationError,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    configureInternalExternalBounds,
    createInternalExternalAtom,
    ExternalSourceDeliveryLimitError,
    ExternalSourceOperationError,
} from "../../src/v1-internal/committed-store-tree/external-atom"
import { ExternalInspectionEvent } from "../../src/v1-internal/committed-store-tree/external-inspection-protocol"
import { evaluateSelector } from "../../src/v1-internal/selector-evaluator/evaluate"

function tracing(recordExtension: (code: number) => void) {
    const evaluate: typeof evaluateSelector = (...args) =>
        evaluateSelector(...args)
    Object.defineProperty(evaluate, "recordExtension", {
        value: recordExtension,
    })
    return Object.assign(() => {}, { evaluate })
}

function thrown(operation: () => unknown): unknown {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected failure")
}

for (const [event, committed] of [
    [ExternalInspectionEvent.invalidate, false],
    [ExternalInspectionEvent.publish, true],
] as const) {
    test(`instrumentation event ${event} preserves publication metadata and delivers every callback`, () => {
        const domain = createCommittedStoreTreeDomain()
        const instrumentation = new SubscriberNotificationError([])
        const notification = new Error("notification")
        const tree = domain.createStoreTree(
            undefined,
            tracing(code => {
                if (code === event && value > 0) throw instrumentation
            }),
        )
        let value = 0,
            invalidate!: () => void
        const state = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe(callback) {
                invalidate = callback
                return () => {}
            },
        })
        const calls: number[] = []
        const first = tree.sub(state, () => {
            calls.push(1)
            throw notification
        })
        const second = tree.sub(state, () => {
            calls.push(2)
        })
        value = 1
        const error = thrown(invalidate) as ExternalSourceOperationError
        expect(error).toBeInstanceOf(ExternalSourceOperationError)
        expect(error.causes).toEqual([instrumentation, notification])
        expect(error.causes[0]).toBe(instrumentation)
        expect(
            error.failures.map(({ phase, committed }) => ({
                phase,
                committed,
            })),
        ).toEqual([
            { phase: "instrumenting", committed },
            { phase: "notifying", committed: true },
        ])
        expect(calls).toEqual([1, 2])
        expect(tree.get(state)).toBe(1)
        first()
        second()
        tree.dispose()
    })
}

test("delivery-limit instrumentation preserves both failures and a later delivery recovers", () => {
    const domain = createCommittedStoreTreeDomain()
    let value = 0
    const invalidators: (() => void)[] = []
    const state = createInternalExternalAtom(domain, {
        getSnapshot: () => value,
        subscribe(callback) {
            invalidators.push(callback)
            return () => {}
        },
    })
    configureInternalExternalBounds(domain, { deliveryDepth: 1 })
    const instrumentation = new SubscriberNotificationError([])
    const first = domain.createStoreTree()
    const second = domain.createStoreTree(
        undefined,
        tracing(code => {
            if (code === ExternalInspectionEvent.deliveryLimit)
                throw instrumentation
        }),
    )
    let bounded: unknown
    const stopFirst = first.sub(state, () => {
        bounded = thrown(invalidators[1]!)
    })
    const seen: number[] = []
    const stopSecond = second.sub(state, () => {
        seen.push(second.get(state))
    })
    value = 1
    invalidators[0]!()
    expect(bounded).toBeInstanceOf(ExternalSourceOperationError)
    const error = bounded as ExternalSourceOperationError
    expect(error.causes[0]).toBeInstanceOf(ExternalSourceDeliveryLimitError)
    expect(error.causes[1]).toBe(instrumentation)
    expect(error.failures.map(failure => failure.phase)).toEqual([
        "sampling",
        "instrumenting",
    ])
    expect(
        error.failures.every(
            failure =>
                failure.source === "external-invalidation" &&
                !failure.committed,
        ),
    ).toBe(true)
    expect(Object.isFrozen(error.failures)).toBe(true)
    expect(seen).toEqual([])
    invalidators[1]!()
    expect(seen).toEqual([1])
    stopFirst()
    stopSecond()
    first.dispose()
    second.dispose()
})
